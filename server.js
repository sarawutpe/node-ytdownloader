const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const dotenv = require("dotenv");
const { google } = require("googleapis");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.options("*", cors());
app.use(express.json());

const middleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Bearer token missing or invalid" });
  }

  const token = authHeader.split(" ")[1];

  if (token !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid token" });
  }

  next();
};

app.get("/", (req, res) => {
  res.send("Express");
});

const extractVideoId = (url) => {
  const regex = /(?:https?:\/\/(?:www\.)?youtube\.com(?:\/(?:[^\/\n\s]+\/\S+|\S+))?(?:\/\S+)?(?:[?&]v=)([a-zA-Z0-9_-]{11}))/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

app.post("/metadata", middleware, async (req, res) => {
  const { url } = req.body;

  // Extract the video ID from the URL
  const videoId = extractVideoId(url);

  if (!videoId) {
    return res.status(400).send("Invalid YouTube URL");
  }

  try {
    const youtube = google.youtube({
      version: "v3",
      auth: process.env.GOOGLE_API_KEY,
    });

    // Fetch video metadata
    const response = await youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: videoId,
    });

    const video = response.data.items[0];

    if (!video) {
      return res.status(404).send("Video not found");
    }

    console.log(response.data);

    res.json({
      title: video.snippet.title,
      description: video.snippet.description,
      viewCount: video.statistics.viewCount,
      more: video
    });
  } catch (error) {
    console.error("Error fetching video data:", error);
    res.status(500).send("An error occurred while fetching video data");
  }
});
app.get("/ping", (req, res) => {
  res.status(200).json({
    status: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.post("/metadatas", middleware, async (req, res) => {
  try {
    const { url } = req.body;
    const params = new URL(url).searchParams;
    const v = params.get("v");
    const newUrl = `https://www.youtube.com/watch?v=${v}`;

    console.log(req.headers.cookie);
    // const cookies = req.headers.cookie;
    // if (!cookies) {
    //   return res.status(400).json({ status: false, error: "Cookies are required for authentication." });
    // }
    // const agentOptions = {};
    // const agent = ytdl.createAgent(cookies, agentOptions);
    const info = await ytdl.getBasicInfo(newUrl);
    res.status(200).json({ status: true, data: info.videoDetails });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, error: "Failed to fetch video metadata" });
  }
});

app.post("/download", middleware, async (req, res) => {
  const { url } = req.body;

  // Check if URL is validç
  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ status: false, error: "Invalid YouTube URL" });
  }

  try {
    const video = ytdl(url, { filter: "audioandvideo", quality: "highest" });
    ffmpeg()
      .input(video)
      .audioCodec("libmp3lame")
      .audioBitrate(128) // 128 192 256 320
      .format("mp3")
      .pipe(res, { end: true });
  } catch (err) {
    console.error("Error downloading MP4:", err);
    res.status(500).json({ status: false, error: "Failed to download MP4" });
  }
});

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
