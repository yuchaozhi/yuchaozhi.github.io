# Jekyll 3.10 的 liveserve（hawkins）在 Ruby 3.4 下不传 MimeTypesCharset，请求会 500。
# 用 Jekyll 自带的 livereload：改文件后自动重新构建并刷新浏览器。
bundle exec jekyll serve --livereload --host 127.0.0.1 --port 4000
