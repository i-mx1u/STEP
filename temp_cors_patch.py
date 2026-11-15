import re

with open('server/src/index.ts', 'r') as f:
    content = f.read()

# Replace the CORS middleware block
old_cors = """app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.clientOrigins.includes(origin)) return callback(null, true);
      if (!config.isProduction && /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: false,
  }),
);"""

new_cors = '''// Custom CORS middleware — handles production origins, Vercel previews, and OPTIONS preflights
const allowOrigin = (origin: string | string | undefined) => {
  if (!origin) return true // no origin (e.g. curl, mobile apps) — allow
  // Check against allowed origins list (trailing slashes ignored)
  const allowed = config.clientOrigins.some(o => o.replace(/\/+$/, '').replace(/^http:/, 'https:') === origin.replace(/\/+$/, '').replace(/^http:/, 'https:'))
  if (allowed) return true
  // Allow Vercel preview domains if CORS_ALLOW_VERCEL=true
  if (config.corsAllowVercel && /\.vercel\.app$/.test(origin)) return true
  // Allow all in development
  if (!config.isProduction) return true
  return false
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (allowOrigin(origin)) return callback(null, true)
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`))
    },
    methods: GET, POST, PUT, PATCH, DELETE, OPTIONS,
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

// Handle OPTIONS preflight explicitly so it returns 204 with CORS headers
app.options('*', (req, res) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.set('Access-Control-Max-Age', '86400')
  res.status(204).end()
})
app.use((req, res, next) => {
  // Append CORS headers to every response
  if (req.headers.origin) {
    res.set('Access-Control-Allow-Origin', req.headers.origin)
    res.set('Vary', 'Origin')
  }
  next()
})
'''

content = content.replace(old_cors, new_cors)

with open('server/src/index.ts', 'w') as f:
    f.write(content)

print('CORS middleware patched successfully')
