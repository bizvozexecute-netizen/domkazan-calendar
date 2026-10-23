import {test,expect} from './live-fixture';

test('existing Rutube film really plays after user action and is removed on photo switch',async({page},testInfo)=>{
  await page.goto('/calendar-test-311744409?house=956218018842');
  await page.getByRole('button',{name:'Видео Rutube',exact:true}).click();
  const iframe=page.locator('iframe[title="Видео дома на Rutube"]');await expect(iframe).not.toHaveAttribute('allow',/autoplay/);
  const frame=page.frameLocator('iframe[title="Видео дома на Rutube"]');
  const video=frame.locator('video');await expect(video).toHaveCount(1,{timeout:45000});
  expect(await video.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
  await frame.getByRole('button',{name:/Воспроизвести видео/}).last().click();
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>!v.paused&&v.currentTime>1.2),{timeout:30000}).toBe(true);
  const evidence=await video.evaluate((v:HTMLVideoElement)=>({paused:v.paused,time:v.currentTime,readyState:v.readyState,duration:v.duration}));
  await testInfo.attach('playback-proof.json',{body:JSON.stringify(evidence),contentType:'application/json'});
  await page.screenshot({path:testInfo.outputPath('real-video-playing.png')});
  await expect(page.getByRole('link',{name:'Открыть видео в Rutube ↗',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Фото 1',exact:true}).click();await expect(iframe).toHaveCount(0);
});
