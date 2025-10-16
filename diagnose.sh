#!/bin/bash

echo "🔍 FACT Project Diagnostic Script"
echo "================================="
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Dependencies not installed - run 'npm install'"
fi

# Check if .env file exists
if [ -f ".env" ]; then
    echo "✅ .env file exists"
else
    echo "❌ .env file missing - create one with required variables (see README)"
fi

# Check if package.json exists
if [ -f "package.json" ]; then
    echo "✅ package.json exists"
else
    echo "❌ package.json missing"
fi

# Check if vite.config.js exists
if [ -f "vite.config.js" ]; then
    echo "✅ vite.config.js exists"
else
    echo "❌ vite.config.js missing"
fi

# Check if src directory exists
if [ -d "src" ]; then
    echo "✅ src directory exists"
    
    # Check key files
    if [ -f "src/App.jsx" ]; then
        echo "✅ App.jsx exists"
    else
        echo "❌ App.jsx missing"
    fi
    
    if [ -f "src/pages/AdminDashboard.jsx" ]; then
        echo "✅ AdminDashboard.jsx exists"
    else
        echo "❌ AdminDashboard.jsx missing"
    fi
    
    # Legacy Supabase client file should not exist anymore
    if [ -f "src/api/supabaseClient.js" ]; then
        echo "⚠️  Legacy supabaseClient.js found (should be removed)"
    fi
else
    echo "❌ src directory missing"
fi

echo ""
echo "📋 Next Steps:"
echo "1. If dependencies are missing: npm install"
echo "2. If .env is missing: cp .env.example .env (then configure)"
echo "3. Start development server: npm run dev"
echo "4. Access admin dashboard: http://localhost:5173/AdminDashboard"
