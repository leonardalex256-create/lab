import { Router } from "express";
import { Op } from "sequelize";
import type { Config } from "../config.js";
import { NoticeBoardEntry, NoticeBoardComment, User, StaffMember } from "../models/index.js";
import { requirePermission } from "../middleware/requirePermission.js";

export function createMeCommunicationNoticesRouter() {
  const r = Router();

  /** List notices with comment count and last 3 comments (optional). */
  r.get("/", async (req, res) => {
    try {
      const notices = await NoticeBoardEntry.findAll({
        order: [["publishedAt", "DESC"]],
        include: [
          {
            model: NoticeBoardComment,
            as: "comments",
            limit: 5,
            order: [["createdAt", "DESC"]],
          },
        ],
      });

      return res.json({
        items: notices.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          type: n.type,
          authorLabel: n.authorLabel,
          eventDate: n.eventDate,
          publishedAt: n.publishedAt,
          comments: (n.comments ?? []).map((c) => ({
            id: c.id,
            authorName: c.authorName,
            body: c.body,
            createdAt: c.createdAt,
          })),
        })),
      });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  /** Add a notice (Admin only). */
  r.post("/", requirePermission("communication_notice"), async (req, res) => {
    try {
      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { title, body, type, eventDate } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: "Title and body are required." });
      }

      const staff = await StaffMember.findOne({ where: { userId: req.userId } });
      const authorLabel = staff?.displayName ?? user.email.split("@")[0];

      const notice = await NoticeBoardEntry.create({
        authorUserId: req.userId,
        authorLabel,
        title,
        body,
        type: type || "general",
        eventDate: eventDate || null,
        publishedAt: new Date(),
      });

      return res.status(201).json({ item: notice });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  /** Update a notice (Admin only). */
  r.patch("/:id", requirePermission("communication_notice"), async (req, res) => {
    try {
      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const id = parseInt(req.params.id, 10);
      const notice = await NoticeBoardEntry.findByPk(id);
      if (!notice) return res.status(404).json({ error: "Notice not found." });

      const { title, body, type, eventDate } = req.body;
      await notice.update({
        ...(title ? { title } : {}),
        ...(body ? { body } : {}),
        ...(type ? { type } : {}),
        eventDate: eventDate !== undefined ? eventDate : notice.eventDate,
      });

      return res.json({ item: notice });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  /** Delete a notice (Admin only). */
  r.delete("/:id", requirePermission("communication_notice"), async (req, res) => {
    try {
      const user = await User.findByPk(req.userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const id = parseInt(req.params.id, 10);
      const notice = await NoticeBoardEntry.findByPk(id);
      if (!notice) return res.status(404).json({ error: "Notice not found." });

      const sequelize = NoticeBoardEntry.sequelize;
      if (!sequelize) {
        return res.status(500).json({ error: "Database not initialized" });
      }
      await sequelize.transaction(async (t) => {
        await NoticeBoardComment.destroy({
          where: { noticeId: id },
          transaction: t,
        });
        await notice.destroy({ transaction: t });
      });

      return res.status(204).send();
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  /** Get comments for a notice. */
  r.get("/:id/comments", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const comments = await NoticeBoardComment.findAll({
        where: { noticeId: id },
        order: [["createdAt", "ASC"]],
      });
      return res.json({ items: comments });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  /** Add a comment to a notice. */
  r.post("/:id/comments", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { body } = req.body;
      if (!body) return res.status(400).json({ error: "Comment body is required." });

      const notice = await NoticeBoardEntry.findByPk(id);
      if (!notice) return res.status(404).json({ error: "Notice not found." });

      const user = await User.findByPk(req.userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const staff = await StaffMember.findOne({ where: { userId: req.userId } });
      const authorName = staff?.displayName ?? user.email.split("@")[0];

      const comment = await NoticeBoardComment.create({
        noticeId: id,
        userId: req.userId,
        authorName,
        body,
      });

      return res.status(201).json({ item: comment });
    } catch (err) {
      console.error(err);
      return res.status(503).json({ error: "Database unavailable" });
    }
  });

  return r;
}
