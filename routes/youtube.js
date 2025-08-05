import { Router } from 'express';
import ytdlp from 'yt-dlp-exec';

const router = Router();

router.get('/search', async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: 'Missing search query' });
    }

    try {
        const results = await ytdlp(`ytsearch10:${query}`, {
            dumpSingleJson: true,
            flatPlaylist: true,
            noWarnings: true,
        });

        const videos = results.entries.map(video => ({
            id: video.id,
            title: video.title,
            duration: video.duration,
            thumbnail: video.thumbnail,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            uploader: video.uploader
        }));

        res.json({ results: videos });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to search YouTube' });
    }
});

export default router;
