import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export class PDFService {
  /**
   * Generates a styled binary PDF document based on structured resume content and layout style
   */
  static generateResumePDF(resumeData: any, layoutType: string = 'SINGLE_COLUMN', templateName: string = 'FAANG Classic'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 36, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const isTwoColumn = layoutType === 'TWO_COLUMN';
        const primaryColor = isTwoColumn ? '#1e293b' : '#0f172a';
        const accentColor = isTwoColumn ? '#2563eb' : '#3b82f6';
        const textMuted = '#64748b';

        const { fullName, email, phone, location, summary, skills = [], experience = [], education = [], projects = [] } = resumeData || {};

        if (isTwoColumn) {
          // ==================== 2-COLUMN LAYOUT ====================
          // Left Sidebar Background
          doc.rect(0, 0, 190, doc.page.height).fill('#f8fafc');

          // Left Sidebar Content (Contact, Skills, Education)
          let leftY = 40;

          // Candidate Initials Circle Avatar Placeholder
          doc.circle(95, leftY + 30, 26).fillAndStroke(accentColor, '#ffffff');
          doc.fillColor('#ffffff').fontSize(16).text((fullName || 'RC').split(' ').map((n: string) => n[0]).join('').substring(0, 2), 70, leftY + 22, { width: 50, align: 'center' });
          leftY += 75;

          // Contact Details
          doc.fillColor(primaryColor).fontSize(12).text('CONTACT', 20, leftY, { underline: true });
          leftY += 16;
          doc.fillColor('#334155').fontSize(9)
             .text(`Email: ${email || 'N/A'}`, 20, leftY, { width: 155 })
             .text(`Phone: ${phone || 'N/A'}`, 20, leftY + 14, { width: 155 })
             .text(`Location: ${location || 'N/A'}`, 20, leftY + 28, { width: 155 });
          leftY += 50;

          // Skills Section
          doc.fillColor(primaryColor).fontSize(12).text('TECHNICAL SKILLS', 20, leftY, { underline: true });
          leftY += 16;
          skills.forEach((skill: string) => {
            doc.fillColor('#334155').fontSize(9).text(`• ${skill}`, 20, leftY, { width: 155 });
            leftY += 13;
          });
          leftY += 15;

          // Education Section
          doc.fillColor(primaryColor).fontSize(12).text('EDUCATION', 20, leftY, { underline: true });
          leftY += 16;
          education.forEach((edu: any) => {
            doc.fillColor(primaryColor).fontSize(9.5).text(edu.degree || '', 20, leftY, { width: 155, lineBreak: true });
            leftY += 14;
            doc.fillColor(textMuted).fontSize(8.5).text(`${edu.institution || ''} (${edu.year || ''})`, 20, leftY, { width: 155 });
            leftY += 22;
          });

          // Right Main Column (Header, Summary, Experience, Projects)
          let rightX = 210;
          let rightY = 40;

          doc.fillColor(primaryColor).fontSize(22).text(fullName || 'Your Name', rightX, rightY);
          rightY += 28;
          doc.fillColor(accentColor).fontSize(10).text(`Optimized for: ${templateName}`, rightX, rightY);
          rightY += 20;

          // Divider Line
          doc.moveTo(rightX, rightY).lineTo(560, rightY).strokeColor('#e2e8f0').stroke();
          rightY += 12;

          // Summary
          if (summary) {
            doc.fillColor(primaryColor).fontSize(11).text('PROFESSIONAL SUMMARY', rightX, rightY);
            rightY += 14;
            doc.fillColor('#334155').fontSize(9).text(summary, rightX, rightY, { width: 350, align: 'justify' });
            rightY += doc.heightOfString(summary, { width: 350 }) + 14;
          }

          // Experience
          if (experience.length > 0) {
            doc.fillColor(primaryColor).fontSize(11).text('WORK EXPERIENCE', rightX, rightY);
            rightY += 14;
            experience.forEach((exp: any) => {
              doc.fillColor(primaryColor).fontSize(10).text(exp.role || '', rightX, rightY);
              doc.fillColor(textMuted).fontSize(8.5).text(`${exp.company || ''} | ${exp.period || ''}`, rightX + 180, rightY, { align: 'right', width: 170 });
              rightY += 14;

              (exp.bulletPoints || []).forEach((bp: string) => {
                doc.fillColor('#334155').fontSize(8.5).text(`- ${bp}`, rightX + 8, rightY, { width: 340 });
                rightY += doc.heightOfString(bp, { width: 340 }) + 4;
              });
              rightY += 8;
            });
          }

          // Projects
          if (projects.length > 0) {
            doc.fillColor(primaryColor).fontSize(11).text('KEY PROJECTS', rightX, rightY);
            rightY += 14;
            projects.forEach((proj: any) => {
              doc.fillColor(primaryColor).fontSize(9.5).text(proj.title || '', rightX, rightY);
              rightY += 12;
              doc.fillColor('#334155').fontSize(8.5).text(proj.description || '', rightX + 8, rightY, { width: 340 });
              rightY += doc.heightOfString(proj.description || '', { width: 340 }) + 8;
            });
          }

        } else {
          // ==================== 1-COLUMN SINGLE ATS LAYOUT ====================
          let y = 36;
          doc.fillColor(primaryColor).fontSize(24).text(fullName || 'Your Name', { align: 'center' });
          y += 30;
          doc.fillColor(textMuted).fontSize(9.5).text(`${email || ''}  |  ${phone || ''}  |  ${location || ''}`, { align: 'center' });
          y += 20;

          // Horizontal Divider
          doc.moveTo(36, y).lineTo(559, y).strokeColor('#cbd5e1').stroke();
          y += 14;

          // Professional Summary
          if (summary) {
            doc.fillColor(primaryColor).fontSize(12).text('PROFESSIONAL SUMMARY');
            y += 16;
            doc.fillColor('#1e293b').fontSize(9.5).text(summary, { align: 'justify' });
            y += doc.heightOfString(summary, { align: 'justify' }) + 14;
          }

          // Experience Section
          if (experience.length > 0) {
            doc.fillColor(primaryColor).fontSize(12).text('WORK EXPERIENCE');
            y += 16;
            experience.forEach((exp: any) => {
              doc.fillColor(primaryColor).fontSize(10.5).text(exp.role || '', 36, doc.y);
              doc.fillColor(textMuted).fontSize(9).text(`${exp.company || ''} (${exp.period || ''})`, 350, doc.y - 12, { align: 'right' });
              
              (exp.bulletPoints || []).forEach((bp: string) => {
                doc.fillColor('#334155').fontSize(9).text(`•  ${bp}`, 48, doc.y + 3, { width: 500 });
              });
              doc.moveDown(0.5);
            });
            doc.moveDown(0.5);
          }

          // Technical Skills Section
          if (skills.length > 0) {
            doc.fillColor(primaryColor).fontSize(12).text('TECHNICAL SKILLS');
            doc.moveDown(0.3);
            doc.fillColor('#1e293b').fontSize(9.5).text(skills.join('  •  '));
            doc.moveDown(0.8);
          }

          // Education Section
          if (education.length > 0) {
            doc.fillColor(primaryColor).fontSize(12).text('EDUCATION');
            doc.moveDown(0.3);
            education.forEach((edu: any) => {
              doc.fillColor('#1e293b').fontSize(9.5).text(`${edu.degree} - ${edu.institution} (${edu.year})`);
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
