import pino from 'pino'
const transport = pino.transport({
  target: 'pino-pretty'
})
const logger = pino(transport)

export default logger

