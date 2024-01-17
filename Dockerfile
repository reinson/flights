FROM node:lts-alpine
COPY . ./
RUN yarn install --frozen-lockfile
RUN yarn build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build/index.js"]
