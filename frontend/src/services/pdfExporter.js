import jsPDF from 'jspdf';

export class SessionPDFExporter {
    exportSessionToPDF(sessionData, questions) {
        try {
            const doc = new jsPDF();
            let yPosition = 20;
            const margin = 20;
            const pageHeight = 297;
            
            // Helper function to check if we need a new page
            const checkPageBreak = (requiredSpace = 20) => {
                if (yPosition + requiredSpace > pageHeight - margin) {
                    doc.addPage();
                    yPosition = margin;
                }
            };

            // Title
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('VidyaVichara Session Report', margin, yPosition);
            yPosition += 15;

            // Session info
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text(`Session ID: ${sessionData.sessionId}`, margin, yPosition);
            yPosition += 8;
            doc.text(`Export Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, yPosition);
            yPosition += 8;
            doc.text(`Teacher: ${sessionData.teacherName || 'N/A'}`, margin, yPosition);
            yPosition += 15;

            // Add separator line
            doc.setLineWidth(0.5);
            doc.line(margin, yPosition, 190, yPosition);
            yPosition += 10;

            // Summary statistics
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Session Summary', margin, yPosition);
            yPosition += 10;

            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            
            const totalQuestions = questions.length;
            const unansweredQuestions = questions.filter(q => q.status === 'unanswered').length;
            const answeredQuestions = questions.filter(q => q.status === 'answered').length;
            const importantQuestions = questions.filter(q => q.isImportant).length;

            doc.text(`Total Questions: ${totalQuestions}`, margin, yPosition);
            yPosition += 7;
            doc.text(`To Address: ${unansweredQuestions}`, margin, yPosition);
            yPosition += 7;
            doc.text(`Important Questions: ${importantQuestions}`, margin, yPosition);
            yPosition += 7;
            doc.text(`Answered Questions: ${answeredQuestions}`, margin, yPosition);
            yPosition += 15;

            // Questions by category
            const categories = [
                {
                    title: 'Questions To Address',
                    questions: questions.filter(q => q.status === 'unanswered'),
                    color: [231, 76, 60]
                },
                {
                    title: 'Important Questions',
                    questions: questions.filter(q => q.isImportant && q.status !== 'answered'),
                    color: [241, 196, 15]
                },
                {
                    title: 'Answered Questions',
                    questions: questions.filter(q => q.status === 'answered'),
                    color: [39, 174, 96]
                }
            ];

            categories.forEach(category => {
                if (category.questions.length > 0) {
                    checkPageBreak(30);
                    
                    // Category title
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(category.color[0], category.color[1], category.color[2]);
                    doc.text(category.title, margin, yPosition);
                    doc.setTextColor(0, 0, 0); // Reset to black
                    yPosition += 10;

                    // List questions
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'normal');
                    
                    category.questions.forEach((question, index) => {
                        checkPageBreak(25);
                        
                        // Question number and text
                        const questionNumber = `${index + 1}.`;
                        doc.setFont(undefined, 'bold');
                        doc.text(questionNumber, margin, yPosition);
                        
                        doc.setFont(undefined, 'normal');
                        const questionText = this.wrapText(question.text, 85);
                        const lines = questionText.split('\n');
                        
                        lines.forEach((line, lineIndex) => {
                            const xOffset = lineIndex === 0 ? margin + 12 : margin + 12;
                            doc.text(line, xOffset, yPosition);
                            if (lineIndex < lines.length - 1) yPosition += 5;
                        });
                        yPosition += 8;

                        // Question details
                        doc.setFontSize(8);
                        doc.setTextColor(100, 100, 100);
                        const author = question.author?.name || 'Anonymous';
                        const course = question.course || 'N/A';
                        const timestamp = new Date(question.createdAt).toLocaleString();
                        const status = question.isImportant ? 'Important' : (question.status === 'answered' ? 'Answered' : 'Pending');
                        
                        doc.text(`By: ${author} | Course: ${course} | Time: ${timestamp} | Status: ${status}`, margin + 12, yPosition);
                        doc.setTextColor(0, 0, 0); // Reset to black
                        doc.setFontSize(10);
                        yPosition += 10;
                    });
                    
                    yPosition += 10; // Extra space between categories
                }
            });

            // Add page numbers
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(128, 128, 128);
                doc.text(
                    `Page ${i} of ${pageCount}`,
                    doc.internal.pageSize.width - 30,
                    doc.internal.pageSize.height - 10
                );
            }

            // Save the PDF
            const filename = `VidyaVichara-${sessionData.sessionId}-${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
            doc.save(filename);

            return { success: true, filename };
        } catch (error) {
            console.error('PDF export failed:', error);
            return { success: false, error: error.message };
        }
    }

    wrapText(text, maxWidth) {
        if (text.length <= maxWidth) return text;
        
        const words = text.split(' ');
        let result = '';
        let line = '';
        
        words.forEach(word => {
            if ((line + word).length <= maxWidth) {
                line += (line ? ' ' : '') + word;
            } else {
                result += (result ? '\n' : '') + line;
                line = word;
            }
        });
        
        result += (result ? '\n' : '') + line;
        return result;
    }
}

// Export singleton instance
export const sessionPDFExporter = new SessionPDFExporter();