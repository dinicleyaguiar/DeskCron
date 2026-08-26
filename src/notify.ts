import notifier from 'node-notifier';

export async function notify(title: string, message: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    notifier.notify({ title, message, appID: 'DeskCron' }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
