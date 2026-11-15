import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db/index.js';
import { getBookmarkSnapshot } from '../bank.js';
import { requireAuth, type AuthedRequest } from '../auth.js';

export const bookmarksRouter = Router();

bookmarksRouter.use(requireAuth);

bookmarksRouter.get('/', async (req: AuthedRequest, res) => {
  const db = await getDatabase();
  const bookmarks = await db.listBookmarks(req.userId as string);
  res.json({ bookmarks });
});

const addSchema = z.object({
  questionId: z.string().min(3).max(40),
});

bookmarksRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'A valid questionId is required.' });
    return;
  }

  const snapshot = getBookmarkSnapshot(parsed.data.questionId);
  if (!snapshot) {
    res.status(404).json({ error: 'That question is not available in the bank.' });
    return;
  }

  const db = await getDatabase();
  const bookmark = await db.addBookmark(
    req.userId as string,
    snapshot.questionId,
    snapshot.modelId,
    snapshot.section,
    snapshot,
  );

  res.status(201).json({ bookmark });
});

bookmarksRouter.delete('/:questionId', async (req: AuthedRequest, res) => {
  const db = await getDatabase();
  const deleted = await db.deleteBookmark(
    req.userId as string,
    String(req.params.questionId),
  );
  if (!deleted) {
    res.status(404).json({ error: 'Bookmark not found.' });
    return;
  }
  res.status(204).end();
});
