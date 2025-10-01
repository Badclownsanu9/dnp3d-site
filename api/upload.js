// api/upload.js
// Serverless file upload -> Vercel Blob -> returns a public URL
import formidable from "formidable";
import fs from "fs";
import { put } from "@vercel/blob";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = formidable({ multiples: false, maxFileSize: 1024 * 1024 * 100 }); // 100MB
      form.parse(req, (err, flds, fls) => (err ? reject(err) : resolve({ fields: flds, files: fls })));
    });

    const f = files.file;
    if (!f) return res.status(400).json({ error: "No file found in form-data 'file'" });

    // Read file buffer and upload to Blob (public)
    const buf = fs.readFileSync(f.filepath);
    const safeName = `${Date.now()}-${(f.originalFilename || "model").replace(/\s+/g, "_")}`;
    const { url } = await put(`quotes/${safeName}`, buf, { access: "public" });

    return res.status(200).json({
      url,
      name: fields.name || "",
      customerPhone: fields.customerPhone || ""
    });
  } catch (e) {
    console.error("UPLOAD_ERROR:", e);
    return res.status(500).json({ error: "Upload failed", details: String(e?.message || e) });
  }
}
