import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'vercel-api-dev-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/')) {
              try {
                const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                let pathname = url.pathname;
                
                if (pathname.endsWith('/') && pathname !== '/api/') {
                  pathname = pathname.slice(0, -1);
                }

                let filePath = path.resolve(__dirname, `.${pathname}.ts`);
                if (!fs.existsSync(filePath)) {
                  filePath = path.resolve(__dirname, `.${pathname}/index.ts`);
                }

                if (fs.existsSync(filePath)) {
                  const module = await server.ssrLoadModule(filePath);
                  const handler = module.default;
                  
                  if (typeof handler === 'function') {
                    const apiRes = res as any;
                    if (!apiRes.status) {
                      apiRes.status = (code: number) => {
                        apiRes.statusCode = code;
                        return apiRes;
                      };
                    }
                    if (!apiRes.json) {
                      apiRes.json = (data: any) => {
                        apiRes.setHeader('Content-Type', 'application/json');
                        apiRes.end(JSON.stringify(data));
                        return apiRes;
                      };
                    }
                    if (!apiRes.send) {
                      apiRes.send = (data: any) => {
                        apiRes.end(data);
                        return apiRes;
                      };
                    }

                    const apiReq = req as any;
                    apiReq.query = Object.fromEntries(url.searchParams.entries());

                    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                      const contentType = req.headers['content-type'] || '';
                      if (contentType.includes('application/json') && !apiReq.body) {
                        const buffers: any[] = [];
                        for await (const chunk of req) {
                          buffers.push(chunk);
                        }
                        const rawBody = Buffer.concat(buffers).toString();
                        try {
                          apiReq.body = JSON.parse(rawBody);
                        } catch (e) {
                          apiReq.body = rawBody;
                        }
                      }
                    }

                    await handler(apiReq, apiRes);
                    return;
                  }
                }
              } catch (err: any) {
                console.error('Error running serverless function locally:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err.message || 'Internal server error' }));
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
