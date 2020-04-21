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
| HOST | `'https://squoosh.app/'` | Squoosh url, remote or local |
| PROXY | `''` | http proxy url |
| INPUT_DIR | `''` | where contain the image to compress |
| OUTPUT_DIR | `''` | where the compressed image to place |
| EXCLUDE_DIRS | `'.git,node_modules'` | directories with these keys will be skipped, split by `,` |
| MAX_PARALLEL | `'5'` | `0 ~ 10`, the max number of Chromium pages created at a time |
| OVERWRITE | `'false'` | new image will replace the old one if set to `'true'` |
| ABORT_BIGGER | `'false'` | new image will not overwrite when size increased if set to `'true'`, only available if `OVERWRITE` is set to `'true'` |
| FOLLOW_PATH | `'true'` | new image path will like the original if set to `'true'` |
| FOLLOW_TYPE | `'false'` | new image type will same as the original if set to `'true'` |
| ALL_TO | `'mozjpeg'` | `'png' \|\| 'mozjpeg' \|\| 'webp'`, all images will compress to that specified type, only available if `FOLLOW_TYPE` is set to `'false'` |
| PNG_EFFORT | `'2'` | `0 ~ 6`, which increase while compress slower, and new image will be smaller |
| JPEG_QUALITY | `'75'` | `0 ~ 100`, which increase while new image quality will be batter, it may increase the image size as well |
| WEBP_EFFORT | `'4'` | `0 ~ 6`, which increase while compress slower, and new image will be smaller |
| WEBP_QUALITY | `'75'` | `0 ~ 100`, which increase while new image quality will be batter, it may increase the image size as well |
| RESIZE_WIDTH | `''` | `1 ~ 10000`, the width of new image |
| SCALE_UP | `'false'` | new image width will not exceed the original if set to `'false'`, only available if `RESIZE_WIDTH` isn't `''` |
| RESIZE_PRESET | `'1'` | `'0.25' \|\| '0.3333' \|\| '0.5' \|\| '1' \|\| '2' \|\| '3' \|\| '4'`, the scale of new image, only available if `RESIZE_WIDTH` is `''` |
