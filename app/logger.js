import pino from 'pino'

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }, 
  enabled: true,
})

export default logger

