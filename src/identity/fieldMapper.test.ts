import { mapFormFields, detectFillFormIntent } from './fieldMapper';
import { EMPTY_VAULT } from './vault.types';

function assert(cond: boolean, name: string) {
  if (!cond) throw new Error(name);
  console.log('  PASS', name);
}

{
  console.log('Form vault mapper');
  const vault = {
    ...EMPTY_VAULT,
    fullName: 'Mayank Garg',
    email: 'mayank@example.com',
    phone: '+919999999999',
    linkedin: 'https://linkedin.com/in/mayank',
    custom: [{ key: 'Unstop', value: 'MG123' }]
  };
  const fields = [
    { index: 0, name: 'Full Name *', type: 'Edit' },
    { index: 1, name: 'Email', type: 'Edit' },
    { index: 2, name: 'Password', type: 'Edit', isPassword: true },
    { index: 3, name: 'OTP', type: 'Edit' },
    { index: 4, name: 'LinkedIn URL', type: 'Edit' },
    { index: 5, name: 'Unstop ID', type: 'Edit' },
    { index: 6, name: 'Upload Resume', type: 'Edit' }
  ];
  const mapped = mapFormFields(fields, vault);
  assert(mapped[0].value === 'Mayank Garg', 'full name');
  assert(mapped[1].value === 'mayank@example.com', 'email');
  assert(!!mapped[2].skipped, 'password skipped');
  assert(!!mapped[3].skipped, 'otp skipped');
  assert(mapped[4].value.includes('linkedin'), 'linkedin');
  assert(mapped[5].value === 'MG123', 'custom unstop');
  assert(!!mapped[6].skipped, 'resume upload skipped');
  const fillDev = mapFormFields(
    [
      { index: 0, name: 'First name', type: 'Edit' },
      { index: 1, name: 'Street address', type: 'Edit' },
      { index: 2, name: 'Zip', type: 'Edit' }
    ],
    { ...vault, firstName: 'Mayank', addressLine1: '1 MG Road', pincode: '560001' }
  );
  assert(fillDev[0].value === 'Mayank', 'fill.dev first name');
  assert(fillDev[1].value === '1 MG Road', 'fill.dev street');
  assert(fillDev[2].value === '560001', 'fill.dev zip');
  assert(detectFillFormIntent('fill this form') === true, 'fill intent');
  assert(detectFillFormIntent('please send hi to mummy') === false, 'not send');
  console.log('ok');
}
