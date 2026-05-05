echo "=== Lead schema analysis ==="
grep -A 2 "model Lead" packages/db/prisma/schema.prisma | head -5
echo ""
echo "=== Email field in Lead model ==="
grep "email" packages/db/prisma/schema.prisma | grep -v "//"
