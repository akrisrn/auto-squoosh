# Automatic Squoosh

- Copy `.env` to `.env.local`
- Configure `.env.local`
- Run:

```
yarn
yarn run compile
yarn run start
```

### .env

| name | default value | description |
| --- | --- | --- |
| HOST | `https://squoosh.app/` | Squoosh url, remote or local |
| PROXY | `''` | http proxy url |
| INPUT_DIR | `''` | where contain the image to compress |
| OUTPUT_DIR | `''` | where the compressed image to place |
| EXCLUDE_DIRS | `.git,node_modules` | directories with these keys will be skipped, split by `,` |
| OVERWRITE | `false` | new image will replace the old one if set `true` |
| FOLLOW_PATH | `true` | new image's path will like the original if set `true` |
| FOLLOW_TYPE | `false` | new image's type will same as the original if set `true` |
| ALL_TO | `'mozjpeg'` | `'png' \|\| 'mozjpeg' \|\| 'webp'`, all images will compress to specified type, only available if `FOLLOW_TYPE` is set to `false` |
| PNG_EFFORT | `'2'` | `0 ~ 6` |
| JPEG_QUALITY | `'75'` | `0 ~ 100` |
| WEBP_EFFORT | `'4'` | `0 ~ 6` |
| WEBP_QUALITY | `'75'` | `0 ~ 100` |
