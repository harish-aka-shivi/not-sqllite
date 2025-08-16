import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
  enabled: false,
});

export default logger;
