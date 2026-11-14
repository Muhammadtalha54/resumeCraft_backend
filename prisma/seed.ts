import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_ACCOUNTS = [
  {
    email: 'taharajput554@gmail.com',
    name: 'Taha Rajput (Admin)',
  },
  {
    email: 'talha03096627172@gmail.com',
    name: 'Talha (Admin)',
  },
  {
    email: 'mtalhadev11@gmail.com',
    name: 'M Talha Dev (Admin)',
  },
];

const DEFAULT_TEMPLATES = [
  {
    slug: 'ats-friendly',
    name: 'ATS Standard Format',
    description: 'Single-column, high-scoring ATS optimized layout specifically tuned for applicant tracking systems and enterprise recruiters.',
    category: 'ATS Optimized',
    layoutType: 'SINGLE_COLUMN',
    thumbnailUrl: '/public/templates/ats.png',
    isPremium: false,
    isActive: true,
    htmlContent: '<div class="resume ats-friendly">ATS Template Content</div>',
    cssStyles: 'body { font-family: Calibri, sans-serif; font-size: 11pt; color: #111; }',
  },
  {
    slug: 'modern-2-column',
    name: 'Modern Two-Column',
    description: 'Contemporary dual-column structure with an accented sidebar for technical skills, contact info, and education.',
    category: 'Modern / Tech',
    layoutType: 'TWO_COLUMN',
    thumbnailUrl: '/public/templates/modern.png',
    isPremium: false,
    isActive: true,
    htmlContent: '<div class="resume modern">Modern 2-Column Content</div>',
    cssStyles: 'body { font-family: Inter, sans-serif; color: #1e293b; }',
  },
  {
    slug: 'professional-executive',
    name: 'Professional Executive',
    description: 'Polished corporate layout designed for mid-to-senior professionals, management, and executive leaders.',
    category: 'Executive',
    layoutType: 'SINGLE_COLUMN',
    thumbnailUrl: '/public/templates/resume-template.png',
    isPremium: true,
    isActive: true,
    htmlContent: '<div class="resume professional">Professional Content</div>',
    cssStyles: 'body { font-family: Georgia, serif; font-size: 11pt; color: #0f172a; }',
  },
  {
    slug: 'basic-clean',
    name: 'Basic Minimalist',
    description: 'Clean, minimalist typography focused on crisp readability and concise bullet points.',
    category: 'Minimalist',
    layoutType: 'SINGLE_COLUMN',
    thumbnailUrl: '/public/templates/basic.png',
    isPremium: false,
    isActive: true,
    htmlContent: '<div class="resume basic">Basic Clean Content</div>',
    cssStyles: 'body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #222; }',
  },
  {
    slug: 'enterprise-corporate',
    name: 'Enterprise Corporate',
    description: 'Robust enterprise CV design with structured project breakdowns and key achievement callouts.',
    category: 'Enterprise',
    layoutType: 'TWO_COLUMN',
    thumbnailUrl: '/public/templates/enterprise.png',
    isPremium: true,
    isActive: true,
    htmlContent: '<div class="resume enterprise">Enterprise Content</div>',
    cssStyles: 'body { font-family: Roboto, sans-serif; color: #111827; }',
  },
  {
    slug: 'pro-technical',
    name: 'Pro Technical Developer',
    description: 'High-density technical resume prioritizing tech stacks, github repositories, and measurable technical impact.',
    category: 'Engineering',
    layoutType: 'TWO_COLUMN',
    thumbnailUrl: '/public/templates/pro.png',
    isPremium: true,
    isActive: true,
    htmlContent: '<div class="resume pro-dev">Pro Developer Content</div>',
    cssStyles: 'body { font-family: JetBrains Mono, monospace, sans-serif; color: #0f172a; }',
  },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed System Configuration
  await prisma.systemConfig.upsert({
    where: { id: 'default_config' },
    update: {},
    create: {
      id: 'default_config',
      defaultSignupResumeCredits: 10,
      defaultSignupAtsCredits: 5,
    },
  });
  console.log('✅ System configuration initialized.');

  // 2. Seed Pre-configured Admin Accounts
  const defaultPasswordHash = await bcrypt.hash('Admin@resumecraft', 10);

  for (const admin of ADMIN_ACCOUNTS) {
    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (existing) {
      // Ensure role is ADMIN, status ACTIVE, email verified, and password reset to default
      await prisma.user.update({
        where: { email: admin.email },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          plan: 'PRO',
          isEmailVerified: true,
          password: defaultPasswordHash,
        },
      });
      console.log(`ℹ️ Admin account verified/updated: ${admin.email}`);
    } else {
      await prisma.user.create({
        data: {
          email: admin.email,
          name: admin.name,
          password: defaultPasswordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          plan: 'PRO',
          isEmailVerified: true,
          resumeCredits: 9999,
          atsCredits: 9999,
        },
      });
      console.log(`✅ Admin account created: ${admin.email}`);
    }
  }

  // 3. Seed Default Templates
  for (const tmpl of DEFAULT_TEMPLATES) {
    await prisma.template.upsert({
      where: { slug: tmpl.slug },
      update: {
        name: tmpl.name,
        description: tmpl.description,
        category: tmpl.category,
        layoutType: tmpl.layoutType,
        thumbnailUrl: tmpl.thumbnailUrl,
        isPremium: tmpl.isPremium,
        isActive: tmpl.isActive,
      },
      create: tmpl,
    });
  }
  console.log(`✅ ${DEFAULT_TEMPLATES.length} Resume templates seeded/updated.`);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
