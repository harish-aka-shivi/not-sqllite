// import pino from "pino";

// const logger = pino({
//   transport: {
//     target: "pino-pretty",
//   },
//   enabled: false,
// });

// // Mock logger

let logger = {
  info: () => {},
};

export default logger;
