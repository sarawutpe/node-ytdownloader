const express = require("express");
const ytdl = require("@distube/ytdl-core");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Bearer token missing or invalid" });
  }

  const token = authHeader.split(" ")[1];

  if (token !== process.env.API_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid token" });
  }

  next();
});

app.get("/", (req, res) => {
  res.send("Express");
});

app.get("/ping", (req, res) => {
  res.status(200).json({ status: true, data: "Server is ready!" });
});

app.post("/metadata", async (req, res) => {
  const { url } = req.body;
  const params = new URL(url).searchParams;
  const v = params.get("v");
  const newUrl = `https://www.youtube.com/watch?v=${v}`;
  const info = await ytdl.getInfo(newUrl);
  res.status(200).json({ status: true, data: info.videoDetails });
});

app.post("/download", async (req, res) => {
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
