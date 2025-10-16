/**
 * Vite Security Headers Plugin
 * Adds security headers to development and production builds
 */

export default function securityHeaders() {
  return {
    name: 'security-headers',
    
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Content Security Policy
        // Note: In production, tighten 'unsafe-inline' and 'unsafe-eval'
        res.setHeader(
          'Content-Security-Policy',
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.googletagmanager.com https://js.stripe.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.neon.tech https://accounts.google.com https://www.googleapis.com https://region1.google-analytics.com https://api.stripe.com https://*.netlify.app https://*.netlify.com wss://*.neon.tech",
            "frame-src 'self' https://accounts.google.com https://js.stripe.com https://www.youtube.com https://youtube.com https://youtu.be https://vimeo.com https://player.vimeo.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests"
          ].join('; ')
        );
        
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        
        // Prevent MIME sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Referrer policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // Feature policy / Permissions policy
        res.setHeader(
          'Permissions-Policy',
          'camera=(), microphone=(), geolocation=(), interest-cohort=()'
        );
        
        // XSS Protection (legacy but still useful)
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        // HSTS - Only in production with HTTPS
        // Note: This header is set by Netlify in production
        // Uncomment below if deploying elsewhere:
        // if (!isDev) {
        //   res.setHeader(
        //     'Strict-Transport-Security',
        //     'max-age=31536000; includeSubDomains; preload'
        //   );
        // }
        
        // Remove powered-by header
        res.removeHeader('X-Powered-By');
        
        next();
      });
    },
    
    transformIndexHtml(html) {
      // Add security meta tags (X-Frame-Options removed - must be HTTP header only)
      const securityMeta = [
        '<meta http-equiv="X-Content-Type-Options" content="nosniff">',
        '<meta http-equiv="X-XSS-Protection" content="1; mode=block">',
        '<meta name="referrer" content="strict-origin-when-cross-origin">'
      ].join('\n    ');
      
      // Insert before closing head tag
      return html.replace('</head>', `    ${securityMeta}\n  </head>`);
    }
  };
}
