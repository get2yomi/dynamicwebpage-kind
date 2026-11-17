# Web image: get2kunle/staticsite
# nginx serves the Jupiter site and forwards /api/* to the API service named "api".
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Only the website goes into the web root (no compose files, Dockerfiles, docs, etc.)
COPY html/ /usr/share/nginx/html/
EXPOSE 80
