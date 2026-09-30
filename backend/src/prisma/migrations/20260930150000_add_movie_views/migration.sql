ALTER TABLE "Movie" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MovieViewSession" (
    "id" SERIAL NOT NULL,
    "movieId" INTEGER NOT NULL,
    "sessionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovieViewSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MovieViewSession_sessionId_key" ON "MovieViewSession"("sessionId");
CREATE INDEX "MovieViewSession_movieId_createdAt_idx" ON "MovieViewSession"("movieId", "createdAt");
ALTER TABLE "MovieViewSession" ADD CONSTRAINT "MovieViewSession_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
