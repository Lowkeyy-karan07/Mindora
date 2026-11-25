import { test, expect } from '@playwright/test';

test.describe('Mindora End-to-End User Journey', () => {
  test('clicks through complete journey: check-in → recommendations → breathing activity → feedback → dashboard → delete', async ({
    page,
  }) => {
    // 1. Visit Home (Check-in)
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Mindora/);

    // Verify footer disclaimer exists on page
    const footer = page.locator('footer');
    await expect(footer).toContainText(
      "Mindora is for everyday wellbeing support. It isn't a therapist, medical service, or emergency service."
    );

    // Verify 5 mood cards
    const moodRadios = page.getByRole('radio');
    await expect(moodRadios).toHaveCount(5);

    // Verify privacy line
    await expect(page.locator('body')).toContainText('Privacy & Data');

    // 2. Test Safety trigger
    await page.getByRole('radio', { name: 'Anxious' }).click();
    await page.getByPlaceholder(/What feels heavy/i).fill('I want to end my life');
    await page.getByRole('button', { name: /Get suggestions/i }).click();

    // Verify Safety Screen appeared
    await expect(page.getByText('Your wellbeing and safety come first')).toBeVisible();
    await expect(page.getByText('A Trusted Person')).toBeVisible();
    await expect(page.getByText('Local Crisis Helpline')).toBeVisible();
    await expect(page.getByText('Local Emergency Services')).toBeVisible();

    // Return to check-in
    await page.getByRole('button', { name: /Return to Check-in/i }).click();
    await expect(page.getByText('How are you feeling right now?')).toBeVisible();

    // 3. Normal check-in
    await page.getByRole('radio', { name: 'Anxious' }).click();
    await page.getByPlaceholder(/What feels heavy/i).fill('Feeling butterflies in my stomach before my presentation');
    await page.getByRole('button', { name: /Get suggestions/i }).click();

    // 4. Ordered Plan view
    await expect(page.getByText('Your personal wellbeing plan')).toBeVisible();
    const startNowBtn = page.getByRole('button', { name: /Start now/i });
    await expect(startNowBtn).toBeVisible();
    const nextStartButtons = page.getByRole('button', { name: /Start Activity/i });
    await expect(nextStartButtons).toHaveCount(2);

    // Verify "Rules" or "AI" label present
    await expect(page.getByText(/Rules|AI/i).first()).toBeVisible();

    // Click "Start now" on Right now recommendation (one tap into player)
    await startNowBtn.click();

    // 5. Activity Player Screen (/activity/[sessionId])
    await expect(page).toHaveURL(/.*\/activity\/.+/);

    // Verify STOP button is visible
    const stopButton = page.getByRole('button', { name: /Stop/i });
    await expect(stopButton).toBeVisible();

    // Verify footer disclaimer still present
    await expect(page.locator('footer')).toContainText(
      "Mindora is for everyday wellbeing support. It isn't a therapist, medical service, or emergency service."
    );

    // Complete activity (advance steps if grounding, then click Finish button)
    while (await page.getByRole('button', { name: /Next Step/i }).isVisible()) {
      await page.getByRole('button', { name: /Next Step/i }).click();
    }
    const finishButton = page.getByRole('button', { name: /Finish Early|Complete Practice|Save & Finish|Finish Break|Finish Break Early|Skip writing and finish/i });
    await expect(finishButton).toBeVisible();
    await finishButton.click();

    // 6. Feedback Screen
    await expect(page.getByText('Was this activity helpful?')).toBeVisible();
    const yesButton = page.getByRole('button', { name: /Yes/i });
    await expect(yesButton).toBeVisible();
    await expect(page.getByRole('button', { name: /A little/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /No/i })).toBeVisible();

    // Submit feedback -> returns to plan with Done & Next highlighted
    await yesButton.click();
    await expect(page.getByTestId('now-done-badge')).toBeVisible();
    await expect(page.getByTestId('next-section')).toHaveAttribute('data-highlighted', 'true');

    // Navigate to Dashboard via View Dashboard link
    await page.getByRole('link', { name: /View Dashboard/i }).click();

    // 7. Dashboard Screen
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByText('Wellbeing Dashboard')).toBeVisible();
    await expect(page.getByText('completed sessions')).toBeVisible();
    await expect(page.getByText('Helpful').first()).toBeVisible();

    // 8. Delete Data Flow
    await page.getByRole('button', { name: /Delete my data/i }).click();
    await expect(page.getByText('Erase all your data?')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: /Delete Everything/i }).click();

    // Verify data wiped
    await expect(page.getByText(/All your stored check-ins/i).first()).toBeVisible();
    await expect(page.getByText('No check-ins yet')).toBeVisible();
  });

  test('grounding activity: step-by-step Next/Back navigation and completion', async ({ page }) => {
    // Direct start grounding session
    const res = await page.request.post('http://localhost:3000/api/session', {
      data: { activityId: '5-4-3-2-1-grounding' },
    });
    const json = await res.json();
    const sessionId = json.session.id;

    await page.goto(`http://localhost:3000/activity/${sessionId}`);
    await expect(page.getByText('Step 1 of 5')).toBeVisible();

    // Click Next Step
    await page.getByRole('button', { name: /Next Step/i }).click();
    await expect(page.getByText('Step 2 of 5')).toBeVisible();

    // Click Back
    await page.getByRole('button', { name: /Back/i }).click();
    await expect(page.getByText('Step 1 of 5')).toBeVisible();

    // Advance to end
    for (let i = 1; i < 5; i++) {
      await page.getByRole('button', { name: /Next Step/i }).click();
    }

    await expect(page.getByText('Step 5 of 5')).toBeVisible();
    await page.getByRole('button', { name: /Complete Practice/i }).click();

    // Feedback screen reached
    await expect(page.getByText('Was this activity helpful?')).toBeVisible();
    await page.getByRole('button', { name: /A little/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('journaling activity: typing and saving to /api/journal', async ({ page }) => {
    const res = await page.request.post('http://localhost:3000/api/session', {
      data: { activityId: 'brain-dump' },
    });
    const json = await res.json();
    const sessionId = json.session.id;

    await page.goto(`http://localhost:3000/activity/${sessionId}`);
    await expect(page.getByText(/Reflective Prompt/i)).toBeVisible();

    const textarea = page.getByPlaceholder(/Write freely here/i);
    await textarea.fill('Writing my worries out on paper really clears my mind.');

    await page.getByRole('button', { name: /Save & Finish/i }).click();

    // Feedback screen reached
    await expect(page.getByText('Was this activity helpful?')).toBeVisible();
    await page.getByRole('button', { name: /Yes/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify journal note is displayed on dashboard
    await expect(page.getByText(/Writing my worries out/i)).toBeVisible();
  });
});
