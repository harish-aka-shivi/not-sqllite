import pino from "pino";

// const logger = pino({
//   transport: {
//     target: "pino-pretty",
//   },
//   enabled: true,
// });

// // Mock logger

let logger = {
  info: () => {},
};

export default logger;
