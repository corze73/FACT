#!/bin/bash

# FACT App Launch Readiness Check
echo "🚀 FACT App Launch Readiness Check"
echo "=================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $2${NC}"
        ((FAILED++))
    fi
}

echo -e "\n${BLUE}1. Testing Environment Configuration${NC}"
echo "-----------------------------------"

# Check environment variables
if [ -f .env ]; then
    test_result 0 "Environment file exists"
    
    if grep -q "VITE_DATABASE_URL" .env; then
        test_result 0 "Database URL configured"
    else
        test_result 1 "Database URL not configured"
    fi
    
    if grep -q "VITE_GOOGLE_CLIENT_ID" .env; then
        test_result 0 "Google OAuth configured"
    else
        test_result 1 "Google OAuth not configured"
    fi
    
    if grep -q "STRIPE_SECRET_KEY" .env; then
        test_result 0 "Stripe configuration present"
    else
        test_result 1 "Stripe configuration missing"
    fi
else
    test_result 1 "Environment file missing"
fi

echo -e "\n${BLUE}2. Testing Database Connection${NC}"
echo "------------------------------"

# Test database connection
DB_TEST=$(node test-db-connection.js 2>&1)
if echo "$DB_TEST" | grep -q "Database connection successful"; then
    test_result 0 "Database connection working"
    
    # Extract table count
    TABLE_COUNT=$(echo "$DB_TEST" | grep -c "^   -")
    if [ $TABLE_COUNT -ge 6 ]; then
        test_result 0 "All required database tables present ($TABLE_COUNT tables)"
    else
        test_result 1 "Missing database tables (only $TABLE_COUNT found)"
    fi
else
    test_result 1 "Database connection failed"
fi

echo -e "\n${BLUE}3. Testing Application Structure${NC}"
echo "--------------------------------"

# Check critical files
FILES=(
    "src/App.jsx"
    "src/main.jsx" 
    "src/pages/Landing.jsx"
    "src/pages/Register.jsx"
    "src/pages/FindCoaches.jsx"
    "src/api/entities.jsx"
    "src/databaseClient.js"
    "package.json"
    "index.html"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        test_result 0 "Critical file exists: $file"
    else
        test_result 1 "Missing critical file: $file"
    fi
done

echo -e "\n${BLUE}4. Testing Dependencies${NC}"
echo "----------------------"

# Check if node_modules exists and has key packages
if [ -d "node_modules" ]; then
    test_result 0 "Node modules installed"
    
    KEY_PACKAGES=(
        "react"
        "vite"
        "@radix-ui/react-checkbox"
        "@neondatabase/serverless"
        "stripe"
    )
    
    for package in "${KEY_PACKAGES[@]}"; do
        if [ -d "node_modules/$package" ]; then
            test_result 0 "Key package installed: $package"
        else
            test_result 1 "Missing key package: $package"
        fi
    done
else
    test_result 1 "Node modules not installed"
fi

echo -e "\n${BLUE}5. Testing Build System${NC}"
echo "----------------------"

# Test if the app can build (quick build test)
if npm run build >/tmp/fact-build.log 2>&1; then
    test_result 0 "Application builds successfully"
else
    test_result 1 "Application build failed"
fi

echo -e "\n${BLUE}6. Testing Server Endpoints${NC}"
echo "----------------------------"

# Start server in background for testing
npm run server > /dev/null 2>&1 &
SERVER_PID=$!
sleep 3

# Test health endpoint
HEALTH_TEST=$(curl -s http://localhost:3001/health 2>/dev/null)
if echo "$HEALTH_TEST" | grep -q "ok"; then
    test_result 0 "Server health endpoint working"
    
    if echo "$HEALTH_TEST" | grep -q '"stripe_configured":true'; then
        test_result 0 "Stripe integration configured"
    else
        test_result 1 "Stripe integration not configured"
    fi
else
    test_result 1 "Server health endpoint failed"
fi

# Clean up server
kill $SERVER_PID 2>/dev/null

echo -e "\n${BLUE}7. Testing Frontend Availability${NC}"
echo "--------------------------------"

# Check if frontend dev server is available or can start
if curl -s http://localhost:8888 >/dev/null 2>&1; then
    test_result 0 "Frontend dev server starts successfully"
else
    npm run dev >/tmp/fact-dev.log 2>&1 &
    DEV_PID=$!
    sleep 12

    if curl -s http://localhost:8888 >/dev/null 2>&1 || grep -Eq "localhost:8888|Server now ready|Netlify Dev" /tmp/fact-dev.log; then
        test_result 0 "Frontend dev server starts successfully"
    else
        test_result 1 "Frontend dev server failed to start"
    fi

    kill $DEV_PID 2>/dev/null
    wait $DEV_PID 2>/dev/null
fi

echo -e "\n${BLUE}8. Testing Critical Features${NC}"
echo "----------------------------"

# Check if age groups are implemented in coach registration
if grep -q "age_groups" src/pages/Register.jsx; then
    test_result 0 "Age groups feature implemented in registration"
else
    test_result 1 "Age groups feature missing in registration"
fi

if grep -q "Age Groups You Coach" src/pages/CoachProfile.jsx; then
    test_result 0 "Age groups feature implemented in coach profile"
else
    test_result 1 "Age groups feature missing in coach profile"
fi

# Check Google Analytics integration
if grep -q "gtag" index.html; then
    test_result 0 "Google Analytics integrated"
else
    test_result 1 "Google Analytics not integrated"
fi

echo -e "\n${BLUE}9. Testing Phase 2 Infrastructure${NC}"
echo "----------------------------------"

# Check React Query setup
if grep -q "QueryClientProvider" src/main.jsx; then
    test_result 0 "React Query configured"
else
    test_result 1 "React Query not configured"
fi

if [ -f "src/lib/queryClient.js" ]; then
    test_result 0 "Query client configuration exists"
else
    test_result 1 "Query client configuration missing"
fi

if [ -f "src/hooks/useQueries.js" ]; then
    test_result 0 "Custom React Query hooks exist"
else
    test_result 1 "Custom React Query hooks missing"
fi

# Check rate limiting
if [ -f "netlify/functions/lib/rateLimiter.js" ]; then
    test_result 0 "Rate limiter utility exists"
else
    test_result 1 "Rate limiter utility missing"
fi

if grep -q "rateLimitMiddleware" netlify/functions/users.js; then
    test_result 0 "Rate limiting applied to users endpoint"
else
    test_result 1 "Rate limiting not applied to users endpoint"
fi

# Check error handling
if [ -f "netlify/functions/lib/errorHandler.js" ]; then
    test_result 0 "Error handler utility exists"
else
    test_result 1 "Error handler utility missing"
fi

# Check if toast notifications are implemented
if grep -q "showSuccess\|showError" src/utils/notifications.js 2>/dev/null; then
    test_result 0 "Toast notification system implemented"
else
    test_result 1 "Toast notification system missing"
fi

echo -e "\n${BLUE}=== LAUNCH READINESS SUMMARY ===${NC}"
echo "==============================="
echo -e "✅ Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Tests Failed: ${RED}$FAILED${NC}"
echo -e "📊 Total Tests: $((PASSED + FAILED))"

PASS_RATE=$((PASSED * 100 / (PASSED + FAILED)))
echo -e "📈 Success Rate: $PASS_RATE%"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL SYSTEMS GO! FACT is ready for launch! 🚀${NC}"
    echo -e "${GREEN}✨ The application has passed all critical tests.${NC}"
elif [ $PASS_RATE -ge 85 ]; then
    echo -e "\n${YELLOW}⚠️  MOSTLY READY - Minor issues detected${NC}"
    echo -e "${YELLOW}🔧 Fix the failed tests before full launch.${NC}"
else
    echo -e "\n${RED}🚫 NOT READY FOR LAUNCH${NC}"
    echo -e "${RED}❗ Critical issues must be resolved.${NC}"
fi

echo -e "\n${BLUE}📋 Manual Testing Still Required:${NC}"
echo "- Test coach and client registration flows"
echo "- Test booking creation end-to-end"
echo "- Test payment integration (with your Stripe keys)"  
echo "- Test mobile responsiveness"
echo "- Test admin functionality"

exit $FAILED