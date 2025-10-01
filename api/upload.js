// api/upload.js
import { put } from "@vercel/blob";
import formidable from "formidable";
import fs from "fs/promises";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Only POST allowed");

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({
        multiples: true,
        keepExtensions: true,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowEmptyFiles: false,
      });
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve({ fields: flds, files: fls })));
    });

    // handle both single object and array
    let f = files.file;
    if (Array.isArray(f)) f = f[0];
    if (!f) return res.status(400).json({ error: 'No "file" field found' });

    // different formidable versions expose different path props
    const filepath = f.filepath || f.path || (f._writeStream && f._writeStream.path);
    if (!filepath) return res.status(400).json({ error: "Parser did not provide a temp filepath" });

    const buf = await fs.readFile(filepath);
    const originalName = (f.originalFilename || "model").replace(/\s+/g, "_");
    const key = `quotes/${Date.now()}-${originalName}`;

    const { url } = await put(key, buf, {
      access: "public",
      contentType: f.mimetype || "application/octet-stream",
    });

    return res.status(200).json({
      url,
      name: fields?.name || "",
      customerPhone: fields?.customerPhone || "",
    });
  } catch (e) {
    console.error("UPLOAD_ERROR:", e);
    return res.status(500).json({ error: "Upload failed", details: String(e?.message || e) });
  }
}

