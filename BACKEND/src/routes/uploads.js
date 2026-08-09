import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { imageSize } from "image-size";
import { config } from "../config/index.js";

export default async function uploadRoutes(fastify) {
  fastify.post("/", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ message: "No file uploaded" });
    }

    const { mimetype, filename, file } = data;
    const barangId =
      request.query?.barang_id ||
      request.query?.id_barang ||
      request.headers["x-barang-id"] ||
      request.body?.id_barang ||
      null;
    const isImage = mimetype.startsWith("image/");
    const isAllowed = config.uploads.allowedTypes.some((type) =>
      mimetype.startsWith(type)
    );
    if (!isAllowed) {
      fastify.log.warn(
        { event: "upload_rejected_type", file: filename, mimetype, barangId },
        "Upload rejected"
      );
      return reply.code(415).send({ message: "File type not allowed" });
    }

    await mkdir(config.uploads.dir, { recursive: true });

    const extension = path.extname(filename) || "";
    const safeName = `${crypto.randomUUID()}${extension}`;
    const targetPath = path.join(config.uploads.dir, safeName);

    await pipeline(file, createWriteStream(targetPath));

    const { size } = await stat(targetPath);
    if (size < config.uploads.minFileSize) {
      await unlink(targetPath).catch(() => {});
      const minKb = Math.ceil(config.uploads.minFileSize / 1024);
      fastify.log.warn(
        { event: "upload_rejected_size", file: filename, mimetype, size, barangId, minKb },
        "Upload rejected"
      );
      return reply.code(400).send({
        message: `Ukuran file terlalu kecil. Minimal ${minKb}KB`
      });
    }

    let width = 0;
    let height = 0;
    if (isImage) {
      try {
        const buffer = await readFile(targetPath);
        const dimensions = imageSize(buffer);
        width = dimensions?.width || 0;
        height = dimensions?.height || 0;
        const minWidth = config.uploads.minWidth || 0;
        const minHeight = config.uploads.minHeight || 0; // 0 = tidak divalidasi
        const widthOk = width >= minWidth;
        const heightOk = minHeight === 0 ? true : height >= minHeight;
        if (!widthOk || !heightOk) {
          await unlink(targetPath).catch(() => {});
          const message =
            minHeight === 0
              ? `Lebar gambar minimal ${minWidth}px`
              : `Resolusi gambar minimal ${minWidth}x${minHeight} piksel`;
          fastify.log.warn(
            {
              event: "upload_rejected_resolution",
              file: filename,
              mimetype,
              size,
              width,
              height,
              barangId,
              minWidth,
              minHeight
            },
            "Upload rejected"
          );
          return reply.code(400).send({
            message
          });
        }
      } catch (err) {
        await unlink(targetPath).catch(() => {});
        fastify.log.error(
          {
            event: "upload_error_dimension",
            file: filename,
            mimetype,
            size,
            barangId,
            message: err?.message
          },
          "Upload rejected"
        );
        return reply.code(400).send({ message: "Gagal membaca dimensi gambar" });
      }
    }

    const publicUrl = `/uploads/master_barang/${safeName}`;
    fastify.log.info(
      {
        event: "upload_success",
        filename,
        savedAs: safeName,
        mimetype,
        size,
        sizeKb: Math.round(size / 1024),
        isImage,
        width,
        height,
        barangId,
        url: publicUrl
      },
      "Upload saved"
    );
    return reply.code(201).send({
      fileName: safeName,
      url: publicUrl,
      path: targetPath
    });
  });
}
