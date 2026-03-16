import { Router } from 'express';
import collectionRoutes from './collections.js';
import itemRoutes from './items.js';
import userRoutes from './users.js';
import partyRoutes from './party.js';
import youtubeRoutes from './youtube.js'; // Assuming you have a youtube.js router
import { getR2StorageInfo, validateR2Config } from '../utils/cloudflareR2.js';

const router = Router();

// Root status endpoint - serves HTML interface
router.get('/', (req, res) => {
    const uptime = process.uptime();
    const uptimeFormatted = new Date(uptime * 1000).toISOString().substr(11, 8);
    const memoryUsage = process.memoryUsage();
    // Get R2 storage info
    const r2Info = getR2StorageInfo();
    const r2ConfigValid = validateR2Config();
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Flash Backend API</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                overflow: hidden;
            }

            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }

            .header h1 {
                font-size: 2.5rem;
                margin-bottom: 10px;
                font-weight: 300;
            }

            .status-badge {
                display: inline-block;
                background: rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.9rem;
                margin-top: 10px;
            }

            .content {
                padding: 40px 30px;
            }

            .status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }

            .status-card {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                border: 1px solid #e9ecef;
            }

            .status-card h3 {
                color: #495057;
                margin-bottom: 10px;
                font-size: 0.9rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .status-value {
                font-size: 1.4rem;
                font-weight: 600;
                color: #667eea;
            }

            .routes-section {
                margin-top: 40px;
            }

            .routes-section h2 {
                color: #2c3e50;
                margin-bottom: 20px;
                font-size: 1.8rem;
                border-bottom: 3px solid #667eea;
                padding-bottom: 10px;
            }

            .route-group {
                margin-bottom: 30px;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                overflow: hidden;
            }

            .route-group-header {
                background: #667eea;
                color: white;
                padding: 15px 20px;
                font-weight: 600;
                font-size: 1.1rem;
            }

            .route-list {
                padding: 0;
            }

            .route-item {
                display: flex;
                padding: 12px 20px;
                border-bottom: 1px solid #f1f3f4;
                align-items: center;
            }

            .route-item:last-child {
                border-bottom: none;
            }

            .method {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: bold;
                text-transform: uppercase;
                margin-right: 15px;
                min-width: 60px;
                text-align: center;
            }

            .method-get { background: #d4edda; color: #155724; }
            .method-post { background: #cce5ff; color: #004085; }
            .method-put { background: #fff3cd; color: #856404; }
            .method-delete { background: #f8d7da; color: #721c24; }

            .route-path {
                flex: 1;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                background: #f8f9fa;
                padding: 6px 10px;
                border-radius: 4px;
                margin-right: 15px;
            }

            .route-description {
                color: #6c757d;
                font-size: 0.9rem;
            }

            .footer {
                text-align: center;
                padding: 20px;
                background: #f8f9fa;
                color: #6c757d;
                font-size: 0.9rem;
            }

            @media (max-width: 768px) {
                .header h1 {
                    font-size: 2rem;
                }
                
                .content {
                    padding: 20px 15px;
                }
                
                .route-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .method {
                    margin-right: 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Flash Backend API</h1>
                <div class="status-badge">✅ Service Running</div>
            </div>

            <div class="content">
                <div class="status-grid">
                    <div class="status-card">
                        <h3>Uptime</h3>
                        <div class="status-value">${uptimeFormatted}</div>
                    </div>
                    <div class="status-card">
                        <h3>Memory Usage</h3>
                        <div class="status-value">${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB</div>
                    </div>
                    <div class="status-card">
                        <h3>Node Version</h3>
                        <div class="status-value">${process.version}</div>
                    </div>
                    <div class="status-card">
                        <h3>Environment</h3>
                        <div class="status-value">${process.env.NODE_ENV || 'development'}</div>
                    </div>
                    <div class="status-card">
                        <h3>Storage</h3>
                        <div class="status-value">☁️ Cloudflare R2</div>
                        <div style="font-size: 0.7rem; color: #6c757d; margin-top: 5px;">
                            ${r2ConfigValid ? '✅ Configured' : '❌ Missing Config'}
                        </div>
                    </div>
                    <div class="status-card">
                        <h3>R2 Bucket</h3>
                        <div class="status-value">${r2Info.bucket || 'Not Set'}</div>
                        <div style="font-size: 0.7rem; color: #6c757d; margin-top: 5px;">
                            API Token: ${r2Info.apiTokenConfigured ? '✅' : '❌'}
                        </div>
                    </div>
                </div>

                <div class="routes-section">
                    <h2>📋 Available API Endpoints</h2>

                    <div class="route-group">
                        <div class="route-group-header">📚 Collections</div>
                        <div class="route-list">
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections</span>
                                <span class="route-description">Get all public collections</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections/latest</span>
                                <span class="route-description">Get latest collections</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections/popular</span>
                                <span class="route-description">Get most popular collections</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections/random/:limit</span>
                                <span class="route-description">Get random collections</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections/daily</span>
                                <span class="route-description">Get daily featured collection</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections/search</span>
                                <span class="route-description">Search collections</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections/tags/:tag</span>
                                <span class="route-description">Get collections by tag</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/collections/users/:uid</span>
                                <span class="route-description">Get user's collections</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/collections</span>
                                <span class="route-description">Create new collection</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-put">PUT</span>
                                <span class="route-path">/collections/:id</span>
                                <span class="route-description">Update collection</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-delete">DELETE</span>
                                <span class="route-path">/collections/:uid/:id</span>
                                <span class="route-description">Delete collection</span>
                            </div>
                        </div>
                    </div>

                    <div class="route-group">
                        <div class="route-group-header">📝 Items</div>
                        <div class="route-list">
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/items/upload</span>
                                <span class="route-description">Upload file and add to collection</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/items/upload-url</span>
                                <span class="route-description">Add item from URL</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/items/add-audio</span>
                                <span class="route-description">Add audio to collection</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/items/add-question</span>
                                <span class="route-description">Add question to collection</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/items/remove</span>
                                <span class="route-description">Remove item from collection</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/items/edit</span>
                                <span class="route-description">Edit item in collection</span>
                            </div>
                        </div>
                    </div>

                    <div class="route-group">
                        <div class="route-group-header">👥 Users</div>
                        <div class="route-list">
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/users/:uid</span>
                                <span class="route-description">Get user profile</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/users/username/:slug</span>
                                <span class="route-description">Get user by username slug</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/users/all</span>
                                <span class="route-description">Get all usernames</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/users/createProfile</span>
                                <span class="route-description">Create user profile</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/users/uploadAvatar</span>
                                <span class="route-description">Upload user avatar</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/users/updateUsername</span>
                                <span class="route-description">Change username</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/users/completed-quiz</span>
                                <span class="route-description">Record quiz completion</span>
                            </div>
                        </div>
                    </div>

                    <div class="route-group">
                        <div class="route-group-header">🎉 Party/Multiplayer</div>
                        <div class="route-list">
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/party/host</span>
                                <span class="route-description">Create a party room</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-post">POST</span>
                                <span class="route-path">/party/join</span>
                                <span class="route-description">Join a party room</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/party/:code</span>
                                <span class="route-description">Get party room details</span>
                            </div>
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/party/:code/players</span>
                                <span class="route-description">Get party players list</span>
                            </div>
                        </div>
                    </div>

                    <div class="route-group">
                        <div class="route-group-header">🎬 YouTube</div>
                        <div class="route-list">
                            <div class="route-item">
                                <span class="method method-get">GET</span>
                                <span class="route-path">/youtube/search</span>
                                <span class="route-description">Search YouTube videos</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="footer">
                <p>Flash Backend API • Built with Express.js & Supabase • ${new Date().getFullYear()}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    res.send(html);
});

// Health check endpoint for APIs/monitoring
router.get('/health', (req, res) => {
    const r2Info = getR2StorageInfo();
    const r2ConfigValid = validateR2Config();

    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        environment: process.env.NODE_ENV || 'development',
        storage: {
            provider: r2Info.provider,
            bucket: r2Info.bucket,
            configured: r2ConfigValid,
            apiTokenAvailable: r2Info.apiTokenConfigured,
            endpoint: r2Info.endpoint,
            publicUrl: r2Info.publicUrl
        }
    };
    res.json(healthData);
});

// Mount sub-routers
router.use('/collections', collectionRoutes); // Add collections route
router.use('/items', itemRoutes);
router.use('/users', userRoutes);
router.use('/party', partyRoutes);
router.use('/youtube', youtubeRoutes);
export default router;
