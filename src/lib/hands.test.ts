import assert from 'node:assert/strict';
import { classifyComposeChange, codeFromText, handsApplies, parseHandsJob, wantsSolutionInEditor } from './hands';

const email = parseHandsJob('Email Sam that the launch moves to Monday');
assert.equal(email?.kind, 'email');
if (email?.kind === 'email') {
  assert.equal(email.toName, 'Sam');
  assert.equal(email.toEmail, '');
  assert.equal(email.body, 'the launch moves to Monday');
  assert.equal(email.subject, 'Launch moves to Monday');
}

const addressed = parseHandsJob('Write an email to sam@example.com saying the launch moves to Monday');
assert.equal(addressed?.kind, 'email');
if (addressed?.kind === 'email') assert.equal(addressed.toEmail, 'sam@example.com');

const form = parseHandsJob('Full name Mayank Garg on this form');
assert.equal(form?.kind, 'form');
if (form?.kind === 'form') {
  assert.equal(form.fields.length, 1);
  assert.equal(form.fields[0].label, 'Full name');
  assert.equal(form.fields[0].value, 'Mayank Garg');
}

const many = parseHandsJob('Full name Mayank Garg, email mayank@example.com, phone 9876543210 on this form');
assert.equal(many?.kind, 'form');
if (many?.kind === 'form') {
  assert.deepEqual(many.fields, [
    { label: 'Full name', value: 'Mayank Garg' },
    { label: 'email', value: 'mayank@example.com' },
    { label: 'phone', value: '9876543210' },
  ]);
}

const spoken = parseHandsJob('Fill this form. Full name is Mayank Garg. Email address is mayank@example.com. College is IIT Delhi.');
assert.equal(spoken?.kind, 'form');
if (spoken?.kind === 'form') {
  assert.equal(spoken.fields.length, 3);
  assert.equal(spoken.fields[0].value, 'Mayank Garg');
  assert.equal(spoken.fields[1].label, 'Email address');
  assert.equal(spoken.fields[2].label, 'College');
  assert.equal(spoken.fields[2].value, 'IIT Delhi');
}

const mixed = parseHandsJob('Full name Mayank Garg, password hunter2 on this form');
assert.equal(mixed?.kind, 'form');
if (mixed?.kind === 'form') {
  assert.equal(mixed.fields.length, 1);
  assert.equal(mixed.skippedPassword, true);
}

const put = parseHandsJob('Put Mayank Garg in Full name on this form');
assert.equal(put?.kind, 'form');
if (put?.kind === 'form') {
  assert.equal(put.fields[0].label, 'Full name');
  assert.equal(put.fields[0].value, 'Mayank Garg');
}

assert.equal(parseHandsJob('Fill the form')?.kind, 'refuse');
assert.equal(handsApplies(true, 'Full name Mayank Garg, email mayank@example.com on this form'), null);
assert.equal(parseHandsJob('Fill my cup'), null);

assert.equal(parseHandsJob('Password hunter2 on this form')?.kind, 'refuse');

const spokenBox = parseHandsJob('Cursor ke text box mein yeh likh sakte ho ki: "Please can you tell me how it is helpful and how it can be a game-changer product?" ya kuch aisa hi likh do jisse we can actually feel like doing something productive and it feels like winning a hackathon project, something like that.');
assert.equal(spokenBox?.kind, 'editor');
if (spokenBox?.kind === 'editor') {
  assert.equal(spokenBox.prompt, 'Please can you tell me how it is helpful and how it can be a game-changer product?');
  assert.equal(spokenBox.sendNow, false);
}
assert.equal(parseHandsJob('Cursor text box mein likh do')?.kind, 'refuse');
assert.equal(handsApplies(true, 'Cursor ke text box mein yeh likh do "check the gate"'), null);

const cursor = parseHandsJob('Prompt Cursor: add a cancel button');
assert.equal(cursor?.kind, 'editor');
if (cursor?.kind === 'editor') {
  assert.equal(cursor.prompt, 'add a cancel button');
  assert.equal(cursor.sendNow, false);
}

const runNow = parseHandsJob('Prompt Cursor: add a cancel button and send it');
assert.equal(runNow?.kind, 'editor');
if (runNow?.kind === 'editor') {
  assert.equal(runNow.prompt, 'add a cancel button');
  assert.equal(runNow.sendNow, true);
}

const pasteEditor = parseHandsJob('Copy this code and paste it in the code editor that is open currently.');
assert.equal(pasteEditor?.kind, 'paste');
assert.equal(wantsSolutionInEditor('The window that is open is the lead code editor. Can you please write down the answer code for that for me?'), true);
assert.equal(parseHandsJob('The window that is open is the lead code editor. Can you please write down the answer code for that for me?'), null);
assert.equal(parseHandsJob('can you copy the answer for me'), null);
assert.equal(codeFromText('int start = max(aA, aB);\nint end = min(lA, lB);\nreturn (start > end) ? 0 : (end - start + 1);'), 'int start = max(aA, aB);\nint end = min(lA, lB);\nreturn (start > end) ? 0 : (end - start + 1);');

assert.equal(parseHandsJob('hello how are you'), null);
assert.equal(parseHandsJob('meeting with Wispr flow tomorrow at 5'), null);
assert.equal(parseHandsJob('send it'), null);
assert.equal(parseHandsJob('send it', 'editor')?.kind, 'confirm');
assert.equal(parseHandsJob('submit the form')?.kind, 'confirm');
assert.equal(parseHandsJob('send the email')?.kind, 'confirm');

assert.equal(handsApplies(true, 'Email Sam that the launch moves to Monday'), null);
assert.equal(handsApplies(true, 'submit the form'), null);
assert.equal(handsApplies(true, 'send the email'), null);
assert.equal(handsApplies(true, 'Full name Mayank Garg on this form'), null);
assert.equal(handsApplies(true, 'Prompt Cursor: add a cancel button'), null);
assert.equal(handsApplies(false, 'Prompt Cursor: add a cancel button')?.kind, 'editor');

assert.equal(classifyComposeChange('Hi', 'Hi there, the launch moves to Monday'), 'arm');
assert.equal(classifyComposeChange('', 'send it'), 'arm');
assert.equal(classifyComposeChange('Hi', 'Hii'), 'cancel');
assert.equal(classifyComposeChange('s', 'se', false, 30), 'arm');
assert.equal(classifyComposeChange('s', 'se', false, 250), 'cancel');
assert.equal(classifyComposeChange('Hello there', 'Hello'), 'cancel');
assert.equal(classifyComposeChange('Same', 'Same'), 'noop');
assert.equal(classifyComposeChange('Hello', 'Hello wor'), 'arm');
assert.equal(classifyComposeChange('Hello', 'Hello wor', true), 'arm');

// Hinglish and spoken form-filling tests
const hinglish1 = parseHandsJob('to usmein meri entries fill karo sir, and meri email hai mayankgarg3@gmail.com and mera roll number hai 351.');
assert.equal(hinglish1?.kind, 'form');
if (hinglish1?.kind === 'form') {
  assert.equal(hinglish1.fields.length, 2);
  assert.equal(hinglish1.fields[0].label, 'email');
  assert.equal(hinglish1.fields[0].value, 'mayankgarg3@gmail.com');
  assert.equal(hinglish1.fields[1].label, 'roll number');
  assert.equal(hinglish1.fields[1].value, '351');
}

const hinglish2 = parseHandsJob('is form me email mayankgarg3@gmail.com aur roll number 351 fill kardo');
assert.equal(hinglish2?.kind, 'form');
if (hinglish2?.kind === 'form') {
  assert.equal(hinglish2.fields.length, 2);
  assert.equal(hinglish2.fields[0].value, 'mayankgarg3@gmail.com');
  assert.equal(hinglish2.fields[1].value, '351');
}

const englishForm = parseHandsJob('fill the form with email mayankgarg3@gmail.com and roll number 351');
assert.equal(englishForm?.kind, 'form');
if (englishForm?.kind === 'form') {
  assert.equal(englishForm.fields.length, 2);
  assert.equal(englishForm.fields[0].value, 'mayankgarg3@gmail.com');
  assert.equal(englishForm.fields[1].value, '351');
}

// Paste job tests
const paste1 = parseHandsJob('can you paste this code on the screen wehre the code needs to be pasted please');
assert.equal(paste1?.kind, 'paste');

const paste2 = parseHandsJob('paste this code in the editor');
assert.equal(paste2?.kind, 'paste');

const paste3 = parseHandsJob('is code ko screen pe paste kardo');
assert.equal(paste3?.kind, 'paste');

const paste4 = parseHandsJob('paste the solution into leetcode');
assert.equal(paste4?.kind, 'paste');

console.log('hands tests passed');

