import {test,expect} from '@playwright/test';
import {fixtureOrigin,fixtureProduct,journeyFixture,openFixtureHouse} from './journey-fixture';

for(const path of ['shorts','video','video/private']) {
  test(`Rutube ${path} opens a safe player with its access key`,async({page,context})=>{
    await journeyFixture(context);
    const id='a'.repeat(32);
    const key=path.includes('private')?'?p=synthetic_Key-1':'';
    const url=`https://rutube.ru/${path}/${id}/${key}`;
    await context.route(`${fixtureOrigin}/api/catalog`,route=>route.fulfill({json:{products:[{...fixtureProduct,rutubeUrl:url}]}}));
    await openFixtureHouse(page);
    await page.getByRole('button',{name:'Перейти к видео дома',exact:true}).click();
    await expect(page.locator('.gallery iframe')).toHaveAttribute('src',`https://rutube.ru/play/embed/${id}/${key}`);
    await expect(page.getByRole('link',{name:'Открыть видео в Rutube ↗'})).toHaveAttribute('href',url);
    await expect(page.getByRole('heading',{name:fixtureProduct.name,exact:true})).toBeVisible();
    // This verifies our integration, not the external Rutube player's playback.
  });
}
