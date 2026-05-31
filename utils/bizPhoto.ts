const PHOTOS: Record<string, string[]> = {
  restaurant: [
    'photo-1517248135467-4c7edcad34c4',
    'photo-1555396273-367ea4eb4db5',
    'photo-1414235077428-338989a2e8c0',
    'photo-1551218808-94e220e084d2',
    'photo-1537047902294-62a40c20a6ae',
  ],
  fast_food: [
    'photo-1561758033-7e924f619af1',
    'photo-1550547660-d9450f859349',
    'photo-1568901346375-23c9450c58cd',
  ],
  food_court: [
    'photo-1555396273-367ea4eb4db5',
    'photo-1414235077428-338989a2e8c0',
  ],
  cafe: [
    'photo-1501339847302-ac426a4a7cbb',
    'photo-1495474472287-4d71bcdd2085',
    'photo-1521017432531-fbd92d768814',
    'photo-1442512595331-e89e73853f31',
  ],
  bar: [
    'photo-1514362545857-3bc16c4c7d1b',
    'photo-1470337458703-46ad1756a187',
  ],
  gym: [
    'photo-1534438327276-14e5300c3a48',
    'photo-1571019613454-1cb2f99b2d8b',
    'photo-1583454110551-21f2fa2afe61',
  ],
  sports_centre: [
    'photo-1571019613454-1cb2f99b2d8b',
    'photo-1540497077202-7c8a3999166f',
  ],
  cinema: [
    'photo-1489599849927-2ee91cede3ba',
    'photo-1595769816263-9b910be24d5f',
    'photo-1524985069026-dd778a71c7b4',
  ],
  theatre: [
    'photo-1503095396549-807759245b35',
    'photo-1524985069026-dd778a71c7b4',
  ],
  pharmacy: [
    'photo-1585435557343-3b092031a831',
    'photo-1471864190281-a93a3070b6de',
  ],
  clinic: [
    'photo-1519494026892-80bbd2d6fd0d',
    'photo-1576091160399-112ba8d25d1d',
  ],
  hospital: [
    'photo-1519494026892-80bbd2d6fd0d',
    'photo-1586773860418-d37222d8fce3',
  ],
  mall: [
    'photo-1555529771-835f59fc5efe',
    'photo-1567401893414-76b7b1e5a7a5',
  ],
  marketplace: [
    'photo-1488459716781-31db52582fe9',
    'photo-1533900298318-6b8da08a523e',
  ],
}

const FALLBACK = [
  'photo-1497366216548-37526070297c',
  'photo-1486325212027-8081e485255e',
  'photo-1441986300917-64674bd600d8',
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function getBizPhoto(type: string, nameOrId: string): string {
  const pool = PHOTOS[type] ?? FALLBACK
  const idx = hashStr(nameOrId) % pool.length
  return `https://images.unsplash.com/${pool[idx]}?w=320&h=200&fit=crop&auto=format`
}
