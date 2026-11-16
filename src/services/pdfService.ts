import PDFDocument from 'pdfkit';

export class PDFService {
  /**
   * Generates a styled binary PDF document based on structured resume content and layout style
   */
  static generateResumePDF(
    resumeData: any,
    layoutType: string = 'SINGLE_COLUMN',
    templateName: string = 'FAANG Classic'
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 36, size: 'A4', autoFirstPage: true });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const isTwoColumn = layoutType === 'TWO_COLUMN';
        const primaryColor = isTwoColumn ? '#1e293b' : '#0f172a';
        const accentColor = isTwoColumn ? '#2563eb' : '#3b82f6';
        const textMuted = '#64748b';

        // Listen for new page events so 2-column sidebar background extends seamlessly
        doc.on('pageAdded', () => {
          if (isTwoColumn) {
            doc.save();
            doc.rect(0, 0, 190, doc.page.height).fill('#f8fafc');
            doc.restore();
          }
        });

        // Unwrap nested structured resume if present
        let data = resumeData || {};
        if (data.tailoredStructuredResume && typeof data.tailoredStructuredResume === 'object') {
          data = { ...data, ...data.tailoredStructuredResume };
        } else if (data.extractedStructuredResume && typeof data.extractedStructuredResume === 'object') {
          data = { ...data, ...data.extractedStructuredResume };
        }

        const fullName = (data.fullName || data.name || 'Professional Resume').trim();
        const email = (data.email || '').trim();
        const phone = (data.phone || '').trim();
        const location = (data.location || '').trim();
        const summary = (data.summary || '').trim();

        // Safely parse skills
        let rawSkills = data.skills || [];
        let skills: string[] = [];
        if (typeof rawSkills === 'string') {
          skills = rawSkills.split(/[,•\n]+/).map((s: string) => s.trim()).filter(Boolean);
        } else if (Array.isArray(rawSkills)) {
          skills = rawSkills.map((s: any) => String(s || '').trim()).filter(Boolean);
        }

        // Safely parse experiences
        let rawExp = data.experience || data.experiences || [];
        let experience: any[] = Array.isArray(rawExp) ? rawExp : [];

        // Safely parse education
        let rawEdu = data.education || [];
        let education: any[] = Array.isArray(rawEdu) ? rawEdu : [];

        // Safely parse projects
        let rawProjects = data.projects || [];
        let projects: any[] = Array.isArray(rawProjects) ? rawProjects : [];

        if (isTwoColumn) {
          // ==================== 2-COLUMN LAYOUT ====================
          // Left Sidebar Background
          doc.rect(0, 0, 190, doc.page.height).fill('#f8fafc');

          // Left Sidebar Content (Contact, Skills, Education)
          let leftY = 40;

          // Candidate Initials Circle Avatar
          const initials = fullName
            .split(/\s+/)
            .filter(Boolean)
            .map((n: string) => n[0] || '')
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'RC';

          doc.circle(95, leftY + 30, 26).fillAndStroke(accentColor, '#ffffff');
          doc.fillColor('#ffffff').fontSize(16).text(initials, 70, leftY + 22, { width: 50, align: 'center' });
          leftY += 75;

          // Contact Details
          doc.fillColor(primaryColor).fontSize(11).text('CONTACT', 20, leftY, { underline: true });
          leftY += 16;
          doc.fillColor('#334155').fontSize(8.5);
          if (email) {
            doc.text(`Email: ${email}`, 20, leftY, { width: 155 });
            leftY += 14;
          }
          if (phone) {
            doc.text(`Phone: ${phone}`, 20, leftY, { width: 155 });
            leftY += 14;
          }
          if (location) {
            doc.text(`Location: ${location}`, 20, leftY, { width: 155 });
            leftY += 14;
          }
          leftY += 24;

          // Skills Section
          if (skills.length > 0) {
            doc.fillColor(primaryColor).fontSize(11).text('TECHNICAL SKILLS', 20, leftY, { underline: true });
            leftY += 16;
            skills.forEach((skill) => {
              if (leftY < doc.page.height - 40) {
                doc.fillColor('#334155').fontSize(8.5).text(`• ${skill}`, 20, leftY, { width: 155 });
                leftY += 13;
              }
            });
            leftY += 15;
          }

          // Education Section
          if (education.length > 0) {
            doc.fillColor(primaryColor).fontSize(11).text('EDUCATION', 20, leftY, { underline: true });
            leftY += 16;
            education.forEach((edu: any) => {
              if (leftY < doc.page.height - 50) {
                const degree = edu.degree || edu.title || 'Degree';
                const inst = edu.institution || edu.school || '';
                const yr = edu.year || edu.graduationYear || '';
                doc.fillColor(primaryColor).fontSize(9).text(degree, 20, leftY, { width: 155, lineBreak: true });
                leftY += 13;
                if (inst || yr) {
                  doc.fillColor(textMuted).fontSize(8).text(`${inst}${yr ? ` (${yr})` : ''}`, 20, leftY, { width: 155 });
                  leftY += 18;
                }
              }
            });
          }

          // Right Main Column (Header, Summary, Experience, Projects)
          let rightX = 210;
          let rightY = 40;

          doc.fillColor(primaryColor).fontSize(22).text(fullName, rightX, rightY, { width: 350 });
          rightY += 28;
          doc.fillColor(accentColor).fontSize(10).text(`Optimized for: ${templateName}`, rightX, rightY);
          rightY += 18;

          // Divider Line
          doc.moveTo(rightX, rightY).lineTo(560, rightY).strokeColor('#e2e8f0').stroke();
          rightY += 12;

          // Summary
          if (summary) {
            doc.fillColor(primaryColor).fontSize(11).text('PROFESSIONAL SUMMARY', rightX, rightY);
            rightY += 14;
            doc.fillColor('#334155').fontSize(8.5).text(summary, rightX, rightY, { width: 350, align: 'justify' });
            rightY += doc.heightOfString(summary, { width: 350 }) + 14;
          }

          // Experience
          if (experience.length > 0) {
            doc.fillColor(primaryColor).fontSize(11).text('WORK EXPERIENCE', rightX, rightY);
            rightY += 14;
            experience.forEach((exp: any) => {
              const role = exp.role || exp.title || 'Role';
              const comp = exp.company || exp.organization || '';
              const per = exp.period || exp.duration || '';

              doc.fillColor(primaryColor).fontSize(9.5).text(role, rightX, rightY);
              if (comp || per) {
                doc.fillColor(textMuted).fontSize(8).text(`${comp}${per ? ` | ${per}` : ''}`, rightX + 170, rightY, { align: 'right', width: 180 });
              }
              rightY += 13;

              let bullets: string[] = [];
              if (Array.isArray(exp.bulletPoints)) {
                bullets = exp.bulletPoints.map((b: any) => String(b || '').trim()).filter(Boolean);
              } else if (typeof exp.bulletPoints === 'string') {
                bullets = exp.bulletPoints.split('\n').map((b: string) => b.trim()).filter(Boolean);
              } else if (typeof exp.description === 'string') {
                bullets = exp.description.split('\n').map((b: string) => b.trim()).filter(Boolean);
              }

              bullets.forEach((bp) => {
                const bulletText = bp.startsWith('•') || bp.startsWith('-') ? bp : `• ${bp}`;
                doc.fillColor('#334155').fontSize(8).text(bulletText, rightX + 6, rightY, { width: 344 });
                rightY += doc.heightOfString(bulletText, { width: 344 }) + 3;
              });
              rightY += 6;
            });
          }

          // Projects
          if (projects.length > 0) {
            doc.fillColor(primaryColor).fontSize(11).text('KEY PROJECTS', rightX, rightY);
            rightY += 14;
            projects.forEach((proj: any) => {
              const title = proj.title || proj.name || 'Project';
              const desc = proj.description || '';
              doc.fillColor(primaryColor).fontSize(9).text(title, rightX, rightY);
              rightY += 11;
              if (desc) {
                doc.fillColor('#334155').fontSize(8).text(desc, rightX + 6, rightY, { width: 344 });
                rightY += doc.heightOfString(desc, { width: 344 }) + 6;
              }
            });
          }

        } else {
          // ==================== 1-COLUMN SINGLE ATS LAYOUT ====================
          let y = 36;
          doc.fillColor(primaryColor).fontSize(22).text(fullName, { align: 'center' });
          y += 28;

          const contactParts = [email, phone, location].filter(Boolean);
          if (contactParts.length > 0) {
            doc.fillColor(textMuted).fontSize(9).text(contactParts.join('   |   '), { align: 'center' });
            y += 18;
          }

          // Horizontal Divider
          doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor('#cbd5e1').stroke();
          doc.moveDown(0.6);

          // Professional Summary
          if (summary) {
            doc.fillColor(primaryColor).fontSize(11.5).text('PROFESSIONAL SUMMARY');
            doc.moveDown(0.2);
            doc.fillColor('#1e293b').fontSize(9).text(summary, { align: 'justify' });
            doc.moveDown(0.6);
          }

          // Experience Section
          if (experience.length > 0) {
            doc.fillColor(primaryColor).fontSize(11.5).text('WORK EXPERIENCE');
            doc.moveDown(0.3);
            experience.forEach((exp: any) => {
              const role = exp.role || exp.title || 'Role';
              const comp = exp.company || exp.organization || '';
              const per = exp.period || exp.duration || '';

              doc.fillColor(primaryColor).fontSize(10).text(role, 36, doc.y);
              if (comp || per) {
                doc.fillColor(textMuted).fontSize(8.5).text(`${comp}${per ? ` (${per})` : ''}`, 300, doc.y - 11, { align: 'right', width: 259 });
              }

              let bullets: string[] = [];
              if (Array.isArray(exp.bulletPoints)) {
                bullets = exp.bulletPoints.map((b: any) => String(b || '').trim()).filter(Boolean);
              } else if (typeof exp.bulletPoints === 'string') {
                bullets = exp.bulletPoints.split('\n').map((b: string) => b.trim()).filter(Boolean);
              } else if (typeof exp.description === 'string') {
                bullets = exp.description.split('\n').map((b: string) => b.trim()).filter(Boolean);
              }

              bullets.forEach((bp) => {
                const bulletText = bp.startsWith('•') || bp.startsWith('-') ? bp : `•  ${bp}`;
                doc.fillColor('#334155').fontSize(8.5).text(bulletText, 46, doc.y + 2, { width: 505 });
              });
              doc.moveDown(0.4);
            });
            doc.moveDown(0.4);
          }

          // Technical Skills Section
          if (skills.length > 0) {
            doc.fillColor(primaryColor).fontSize(11.5).text('TECHNICAL SKILLS');
            doc.moveDown(0.3);
            doc.fillColor('#1e293b').fontSize(9).text(skills.join('   •   '));
            doc.moveDown(0.6);
          }

          // Education Section
          if (education.length > 0) {
            doc.fillColor(primaryColor).fontSize(11.5).text('EDUCATION');
            doc.moveDown(0.3);
            education.forEach((edu: any) => {
              const degree = edu.degree || edu.title || 'Degree';
              const inst = edu.institution || edu.school || '';
              const yr = edu.year || edu.graduationYear || '';
              const line = `${degree}${inst ? ` - ${inst}` : ''}${yr ? ` (${yr})` : ''}`;
              doc.fillColor('#1e293b').fontSize(9).text(line);
            });
            doc.moveDown(0.5);
          }

          // Projects Section
          if (projects.length > 0) {
            doc.fillColor(primaryColor).fontSize(11.5).text('KEY PROJECTS');
            doc.moveDown(0.3);
            projects.forEach((proj: any) => {
              const title = proj.title || proj.name || 'Project';
              const desc = proj.description || '';
              doc.fillColor(primaryColor).fontSize(9.5).text(title);
              if (desc) {
                doc.fillColor('#334155').fontSize(8.5).text(desc, 46, doc.y + 2, { width: 505 });
              }
              doc.moveDown(0.3);
            });
          }
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
