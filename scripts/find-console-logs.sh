#!/bin/bash
# Script to find and report console.log usage in production code

echo "🔍 Finding console.log statements in source files..."
echo "=================================================="
echo ""

# Find all console statements in src (excluding node_modules, build, dist)
console_logs=$(grep -r "console\.\(log\|warn\|info\|debug\)" src/ --include="*.jsx" --include="*.js" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -z "$console_logs" ]; then
    echo "✅ No console.log statements found in src/"
else
    echo "Found console statements:"
    echo "$console_logs"
    echo ""
    echo "📊 Summary:"
    echo "Total occurrences: $(echo "$console_logs" | wc -l)"
fi

echo ""
echo "=================================================="
echo "🔍 Finding alert() calls..."
echo "=================================================="
echo ""

alerts=$(grep -r "alert(" src/ --include="*.jsx" --include="*.js" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -z "$alerts" ]; then
    echo "✅ No alert() calls found in src/"
else
    echo "Found alert() calls:"
    echo "$alerts"
    echo ""
    echo "📊 Summary:"
    echo "Total occurrences: $(echo "$alerts" | wc -l)"
fi
