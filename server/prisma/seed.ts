import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Fictional players only — no real IPL/player branding.
// [name, role, rating]
const PLAYERS: Array<[string, 'WK' | 'BAT' | 'BOWL' | 'AR', number]> = [
  // Elite tier (90+)
  ['Arjun Mehta', 'BAT', 96],
  ['Kabir Singh Rathore', 'BAT', 94],
  ['Rohan Iyer', 'WK', 93],
  ['Aditya Kulkarni', 'AR', 95],
  ['Vikram Deshmukh', 'BOWL', 92],
  ['Surya Narayan', 'BAT', 91],
  ['Devang Patel', 'AR', 90],
  ['Ishaan Chowdhury', 'WK', 90],
  // Strong tier (85-89)
  ['Nikhil Bansal', 'BAT', 89],
  ['Pranav Joshi', 'BOWL', 88],
  ['Rahul Nair', 'AR', 88],
  ['Sahil Khan', 'BAT', 87],
  ['Varun Reddy', 'BOWL', 87],
  ['Manav Gupta', 'WK', 86],
  ['Yash Thakur', 'AR', 86],
  ['Harsh Vardhan', 'BAT', 85],
  ['Deepak Chahar', 'BOWL', 85],
  ['Aryan Malhotra', 'AR', 85],
  // Solid tier (80-84)
  ['Kunal Sharma', 'BAT', 84],
  ['Ritvik Menon', 'BOWL', 84],
  ['Om Prakash', 'WK', 83],
  ['Siddharth Rao', 'AR', 83],
  ['Tushar Kulkarni', 'BAT', 82],
  ['Nitin Desai', 'BOWL', 82],
  ['Gaurav Singh', 'AR', 81],
  ['Piyush Jain', 'BAT', 81],
  ['Rakesh Yadav', 'BOWL', 80],
  ['Ankit Tiwari', 'WK', 80],
  ['Mihir Shah', 'AR', 80],
  // Mid tier (75-79)
  ['Vivek Kumar', 'BAT', 79],
  ['Sanjay Mishra', 'BOWL', 79],
  ['Aakash Gupta', 'AR', 78],
  ['Rohit Verma', 'BAT', 78],
  ['Karan Malhotra', 'WK', 77],
  ['Naveen Patil', 'BOWL', 77],
  ['Suresh Menon', 'AR', 76],
  ['Prakash Jha', 'BAT', 76],
  ['Dinesh Kumar', 'BOWL', 75],
  ['Mahesh Iyer', 'AR', 75],
  // Value tier (<75)
  ['Amitabh Bachan Jr', 'BAT', 74],
  ['Ravi Shankar', 'BOWL', 74],
  ['Ganesh Patil', 'WK', 73],
  ['Shivam Dubey', 'AR', 73],
  ['Umesh Yadav Jr', 'BOWL', 72],
  ['Lalit Modi Jr', 'BAT', 72],
  ['Pankaj Singh', 'AR', 71],
  ['Ramesh Powar Jr', 'BOWL', 70],
  ['Sachin Tendulkar Jr', 'BAT', 70],
  ['VVS Laxman Jr', 'BAT', 69],
  ['Javagal Srinath Jr', 'BOWL', 68],
  ['Anil Kumble Jr', 'BOWL', 67],
]

// Base price (in ₹ Cr) derived from rating tier, with slight per-player variation.
function basePriceFor(rating: number, index: number): number {
  let base: number
  if (rating >= 90) base = 15 + (rating - 90) * 0.8
  else if (rating >= 85) base = 10 + (rating - 85) * 0.9
  else if (rating >= 80) base = 6 + (rating - 80) * 0.8
  else if (rating >= 75) base = 3 + (rating - 75) * 0.6
  else base = 0.5 + rating * 0.02
  // deterministic variation so prices don't look uniform
  const variation = ((index * 37) % 10) / 10 // 0.0 - 0.9
  const price = Math.round((base + variation) * 2) / 2 // round to 0.5
  return Math.max(0.5, Math.min(20, price))
}

async function main() {
  console.log('Seeding fictional cricket players...')

  const existing = await prisma.player.count()
  if (existing > 0) {
    console.log(`Player pool already has ${existing} players — skipping.`)
    return
  }

  for (let i = 0; i < PLAYERS.length; i++) {
    const [name, role, rating] = PLAYERS[i]
    await prisma.player.create({
      data: {
        name,
        role,
        rating,
        basePrice: basePriceFor(rating, i),
      },
    })
  }

  console.log(`Seeded ${PLAYERS.length} players.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
