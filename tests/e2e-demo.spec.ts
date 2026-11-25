import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { seedDatabase } from '../src/lib/db/seed';
import { deleteAllUserData } from '../src/lib/db/repository';

test.describe('Mindora E2E (DEMO_MODE=true)', () => {
  test.beforeEach(async () => {
    deleteAllUserData();
    seedDatabase();
  });

  test('Full journey: Anxious + academics note -> ordered plan -> Start now in 1 tap -> feedback returns with Done & Next highlighted -> Later today shows 3 steps -> Dashboard', async ({
    page,
  }) => {
    let tapCount = 0;
    const startTime = Date.now();

    // 1. Open app
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Mindora/);

    // 2. Select "Anxious" mood and fill academic note
    const anxiousCard = page.getByRole('radio', { name: 'Anxious' });
    await expect(anxiousCard).toBeVisible();
    await anxiousCard.click();
    tapCount++;

    const noteInput = page.getByPlaceholder(/What feels heavy/i);
    await expect(noteInput).toBeVisible();
    await expect(noteInput).toHaveAttribute('autocomplete', 'off');
    await noteInput.fill('Not performing well in academics');

    // 3. Click "Get suggestions"
    const getSuggestionsBtn = page.getByRole('button', { name: /Get suggestions/i });
    await expect(getSuggestionsBtn).toBeEnabled();
    await getSuggestionsBtn.click();
    tapCount++;

    // 4. Ordered plan loaded
    await expect(page.getByText('Your personal wellbeing plan')).toBeVisible();
    await expect(page.getByText('Based on what you wrote and how you feel')).toBeVisible();

    // 4a. Reflection card & Why this order
    const ackCard = page.getByRole('region', { name: 'Reflection' });
    await expect(ackCard).toBeVisible();
    await expect(ackCard).toContainText(/academic/i);
    await expect(ackCard.getByText(/Why this order:/i)).toBeVisible();
    await expect(ackCard.locator('span', { hasText: 'Rules' }).first()).toBeVisible();

    // 4b. Your situation card
    const situationCard = page.getByRole('region', { name: 'Your situation' });
    await expect(situationCard).toBeVisible();
    await expect(situationCard.getByText('Template')).toBeVisible();
    await expect(situationCard.getByText(/What's in your control:/i)).toBeVisible();

    // 4c. Right now section shown first with Start now button
    const nowSection = page.getByRole('region', { name: 'Right now' });
    await expect(nowSection).toBeVisible();
    const startNowBtn = nowSection.getByRole('button', { name: /Start now/i });
    await expect(startNowBtn).toBeVisible();

    // 4d. Next, when you're ready shows 2 cards including an academic activity
    const nextSection = page.getByRole('region', { name: "Next, when you're ready" });
    await expect(nextSection).toBeVisible();
    const nextCards = nextSection.getByTestId('next-card');
    await expect(nextCards).toHaveCount(2);
    await expect(nextSection).toContainText(
      /Name the Worry, Then Park It|Break It Into One Small Step|25-Minute Focus Sprint/i
    );

    // 4e. Later today shows 3 action steps + disclaimer + One small step for today
    const laterSection = page.getByRole('region', { name: 'Later today' });
    await expect(laterSection).toBeVisible();
    await expect(laterSection.getByTestId('later-step-card')).toHaveCount(3);
    await expect(
      laterSection.getByText(/These are everyday coping ideas, not medical, legal or professional advice\./i)
    ).toBeVisible();
    const nextStepCard = page.getByRole('region', { name: 'One small step for today' });
    await expect(nextStepCard).toBeVisible();
    await expect(nextStepCard).toContainText(/topic|assignment|timer/i);

    // Click "Start now" directly (1 tap from results into player)
    await startNowBtn.click();
    tapCount++;

    // 5. Activity player started: record ACTUAL elapsed time and tap count metrics
    await expect(page).toHaveURL(/.*\/activity\/.+/);
    const stopButton = page.getByRole('button', { name: /Stop/i });
    await expect(stopButton).toBeVisible();

    const timeToStartMs = Date.now() - startTime;
    const timeToStartSec = (timeToStartMs / 1000).toFixed(2);

    console.log(`\n=== E2E METRICS ===`);
    console.log(`Taps to start activity: ${tapCount}`);
    console.log(`Time from opening app to starting activity: ${timeToStartSec}s (${timeToStartMs}ms)`);
    console.log(`===================\n`);

    const metricsPath = path.resolve(process.cwd(), '.tmp-e2e-metrics.json');
    fs.writeFileSync(
      metricsPath,
      JSON.stringify({
        tapCount,
        timeToStartMs,
        timeToStartSec,
        timestamp: new Date().toISOString(),
      })
    );

    // 6. Complete the Right now activity
    const finishEarlyBtn = page.getByRole('button', { name: /Finish Early/i });
    const finishBreakBtn = page.getByRole('button', { name: /Finish Break Early/i });
    const skipJournalBtn = page.getByRole('button', { name: /Skip writing and finish/i });
    const completePracticeBtn = page.getByRole('button', { name: /Complete Practice/i });
    const nextStepBtn = page.getByRole('button', { name: /Next Step/i });

    if (await finishEarlyBtn.isVisible()) {
      await finishEarlyBtn.click();
    } else if (await finishBreakBtn.isVisible()) {
      await finishBreakBtn.click();
    } else if (await skipJournalBtn.isVisible()) {
      await skipJournalBtn.click();
    } else {
      while (await nextStepBtn.isVisible()) {
        await nextStepBtn.click();
      }
      if (await completePracticeBtn.isVisible()) {
        await completePracticeBtn.click();
      }
    }

    // 7. Submit "Yes" on Feedback screen -> returns to plan with Done & Next highlighted
    await expect(page.getByText('Was this activity helpful?')).toBeVisible();
    const yesBtn = page.getByRole('button', { name: /Yes/i });
    await expect(yesBtn).toBeVisible();
    await yesBtn.click();

    await expect(page.getByText('Your personal wellbeing plan')).toBeVisible();
    await expect(page.getByTestId('now-done-badge')).toBeVisible();
    await expect(page.getByTestId('now-done-badge')).toContainText('Done');
    await expect(page.getByTestId('next-section')).toHaveAttribute('data-highlighted', 'true');
    await expect(page.getByText('Up next')).toBeVisible();

    // 8. Navigate to Dashboard via View Dashboard link
    await page.getByRole('link', { name: /View Dashboard/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByText('Wellbeing Dashboard')).toBeVisible();
    await expect(page.getByText('Anxious').first()).toBeVisible();
    await expect(page.getByText('Helpful').first()).toBeVisible();
  });

  test('Crisis phrase shows safety screen with NO plan or recommendations', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Mindora/);

    await page.getByRole('radio', { name: 'Anxious' }).click();
    const noteArea = page.getByPlaceholder(/What feels heavy/i);
    await noteArea.fill('I cannot take this anymore, I want to end my life');
    await page.getByRole('button', { name: /Get suggestions/i }).click();

    await expect(page.getByText('Your wellbeing and safety come first')).toBeVisible();
    await expect(page.getByText('A Trusted Person')).toBeVisible();
    await expect(page.getByText('Local Crisis Helpline')).toBeVisible();
    await expect(page.getByText('Local Emergency Services')).toBeVisible();

    await expect(page.getByText('Your personal wellbeing plan')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Start now/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Start Activity/i })).toHaveCount(0);

    const returnBtn = page.getByRole('button', { name: /Return to Check-in/i });
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();
    await expect(page.getByText('How are you feeling right now?')).toBeVisible();
  });

  test('Follow-up chat: Anxious + academics note -> "No breathing exercises" removes breathing from Right now and Next without changing Situation or Later -> crisis phrase triggers Safety Screen', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Mindora/);

    await page.getByRole('radio', { name: 'Anxious' }).click();
    await page.getByPlaceholder(/What feels heavy/i).fill('Not performing well in academics');
    await page.getByRole('button', { name: /Get suggestions/i }).click();

    await expect(page.getByText('Your personal wellbeing plan')).toBeVisible();
    await expect(page.getByText('Want to adjust these?')).toBeVisible();

    // Capture Situation & Later before chat
    const situationBefore = await page.getByRole('region', { name: 'Your situation' }).innerText();
    const laterBefore = await page.getByRole('region', { name: 'Later today' }).innerText();

    // Click "No breathing exercises"
    const noBreathingChip = page.getByRole('button', { name: 'No breathing exercises' });
    await expect(noBreathingChip).toBeVisible();
    await noBreathingChip.click();

    // Assistant reply visible
    await expect(page.getByText(/removed breathing exercises/i)).toBeVisible();

    // Zero breathing icons inside Right now + Next
    const nowCard = page.getByTestId('now-card');
    const nextSection = page.getByTestId('next-section');
    await expect(nowCard.locator('span', { hasText: '🌬️' })).toHaveCount(0);
    await expect(nextSection.locator('span', { hasText: '🌬️' })).toHaveCount(0);
    await expect(nextSection.getByTestId('next-card')).toHaveCount(2);

    // Situation & Later remain unchanged
    const situationAfter = await page.getByRole('region', { name: 'Your situation' }).innerText();
    const laterAfter = await page.getByRole('region', { name: 'Later today' }).innerText();
    expect(situationAfter).toBe(situationBefore);
    expect(laterAfter).toBe(laterBefore);

    // Chat input keeps autocomplete=off
    const chatInput = page.getByPlaceholder(/Type a request/i);
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toHaveAttribute('autocomplete', 'off');

    // Type crisis phrase -> immediate Safety Screen
    await chatInput.fill('I want to end my life right now');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText('Your wellbeing and safety come first')).toBeVisible();
    await expect(page.getByText('Local Crisis Helpline')).toBeVisible();
    await expect(page.getByText('Your personal wellbeing plan')).not.toBeVisible();
  });
});
