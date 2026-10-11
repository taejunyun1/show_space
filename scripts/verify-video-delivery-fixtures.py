"""Verify owned six-panel MP4/WebM fixtures with FFprobe and FFmpeg.

Run from the repository root. --generate recreates only these synthetic inputs;
without it, source bytes are preserved and freshly decoded frames must match.
The UI test uses the committed decoded pixels as a video decoder transport.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.STDOUT)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


parser = argparse.ArgumentParser()
parser.add_argument("--generate", action="store_true")
parser.add_argument("--output-dir", type=pathlib.Path,
                    default=pathlib.Path("docs/validation/video-delivery-2026-10-11"))
args = parser.parse_args()
directory = args.output_dir
directory.mkdir(parents=True, exist_ok=True)
fixtures = [("landscape", "mp4", "h264", 640, 360, ["-c:v", "libx264", "-crf", "0", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart"]),
            ("portrait", "webm", "vp9", 360, 640, ["-c:v", "libvpx-vp9", "-lossless", "1", "-an"])]
reports = []
for name, extension, codec, width, height, encoder in fixtures:
    source = directory / f"{name}.{extension}"
    frame = directory / f"{name}-decoded.png"
    if args.generate:
        edges = [0, width // 3, (2 * width + 1) // 3, width]
        colors = ["red", "lime", "blue", "yellow", "cyan", "magenta"]
        filters = [f"color=black:s={width}x{height}:d=1:r=12"]
        for i, color in enumerate(colors):
            col, row = i % 3, i // 3
            filters.append(f"drawbox=x={edges[col]}:y={row * (height // 2)}:w={edges[col + 1] - edges[col]}:h={height // 2}:color={color}:t=fill")
        run("ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", ",".join(filters), *encoder, "-y", str(source))
        run("ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", "0.05", "-i", str(source), "-frames:v", "1", "-y", str(frame))
    metadata = json.loads(run("ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,nb_frames", "-of", "json", str(source)))
    assert len(metadata["streams"]) == 1, metadata
    stream = metadata["streams"][0]
    assert (stream["codec_name"], stream["width"], stream["height"]) == (codec, width, height), metadata
    assert abs(float(metadata["format"]["duration"]) - 1) < 0.001, metadata
    with tempfile.TemporaryDirectory(prefix="gonggan-video-decode-") as tmp:
        decoded = pathlib.Path(tmp) / "frame.png"
        run("ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", "0.05", "-i", str(source), "-frames:v", "1", "-y", str(decoded))
        assert sha(decoded) == sha(frame), "Committed decoder frame differs from the actual codec output"
    reports.append({"file": source.name, "sha256": sha(source), "bytes": source.stat().st_size,
                    "decodedFrame": frame.name, "decodedSha256": sha(frame), "probe": metadata})
report = {"ownedProceduralSource": True, "colors": ["red", "lime", "blue", "yellow", "cyan", "magenta"],
          "seekSeconds": 0.05, "ffmpeg": run("ffmpeg", "-version").decode().splitlines()[0],
          "sources": reports, "freshDecodeMatchesCommittedFrames": True, "browserCodecMeasured": False}
(directory / "fixtures.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"sources": len(reports), "freshDecodeMatchesCommittedFrames": True}))
