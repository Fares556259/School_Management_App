const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const notifications = await prisma.notification.findMany();
  let updatedCount = 0;

  for (const notif of notifications) {
    let newMessage = notif.message;
    let newTitle = notif.title;
    
    // Translation Rules for Message
    if (newMessage.startsWith('A new task for ') && newMessage.includes(' has been assigned to ')) {
      const match = newMessage.match(/A new task for (.*) has been assigned to (.*)\./);
      if (match) newMessage = `تم تعيين مهمة جديدة في ${match[1]} لـ ${match[2]}.`;
    }
    else if (newMessage.startsWith('A remark was left for ') && newMessage.includes(': "')) {
      const match = newMessage.match(/A remark was left for (.*): "(.*)"/);
      if (match) newMessage = `تمت إضافة ملاحظة لـ ${match[1]}: "${match[2]}"`;
    }
    else if (newMessage.startsWith('New educational material shared for ')) {
      const match = newMessage.match(/New educational material shared for (.*)\./);
      if (match) newMessage = `تمت إضافة مواد تعليمية جديدة في مادة ${match[1]}.`;
    }
    else if (newMessage.startsWith('The official exam schedule for Term ')) {
      const match = newMessage.match(/The official exam schedule for Term (.*) is now available\./);
      if (match) newMessage = `تم توفير جدول الامتحانات الرسمي للفترة ${match[1]}.`;
    }
    else if (newMessage.includes(' has been marked as absent on ')) {
      const match = newMessage.match(/(.*) has been marked as absent on (.*)/);
      if (match) newMessage = `تم تسجيل ${match[1]} كـ غائب يوم ${match[2]}`;
    }
    else if (newMessage.includes(' has been marked as late on ')) {
      const match = newMessage.match(/(.*) has been marked as late on (.*)/);
      if (match) newMessage = `تم تسجيل ${match[1]} كـ متأخر يوم ${match[2]}`;
    }

    // Translation Rules for Title
    if (newTitle.startsWith('New Task: ')) {
      newTitle = newTitle.replace('New Task: ', '📝 مهمة جديدة: ');
    }
    else if (newTitle.startsWith('📝 Teacher Remark — ')) {
      newTitle = newTitle.replace('📝 Teacher Remark — ', '📝 ملاحظة المعلم — ');
    }
    else if (newTitle.startsWith('Course Resource: ')) {
      newTitle = newTitle.replace('Course Resource: ', '📚 ملخص جديد: ');
    }
    else if (newTitle.startsWith('Attendance Alert: ')) {
      newTitle = newTitle.replace('Attendance Alert: ABSENT', 'تنبيه الحضور: غياب');
      newTitle = newTitle.replace('Attendance Alert: LATE', 'تنبيه الحضور: تأخير');
    }
    else if (newTitle === '📅 Exam Schedule Updated') {
      newTitle = '📅 تحديث جدول الامتحانات';
    }

    if (newMessage !== notif.message || newTitle !== notif.title) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { message: newMessage, title: newTitle }
      });
      updatedCount++;
    }
  }
  console.log(`Successfully updated ${updatedCount} notifications.`);
}

run()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
