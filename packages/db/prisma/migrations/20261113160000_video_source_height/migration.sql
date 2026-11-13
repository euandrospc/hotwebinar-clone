-- Source video height (px) probed during transcode; nullable for existing rows.
ALTER TABLE "video" ADD COLUMN "sourceHeight" INTEGER;
