export const regex = {
  description:    /^\S(?:.*\S)?$/,
  amount:         /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  date:           /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  category:       /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  duplicateWords: /\b(\w+)\s+\1\b/i
};

export function validate(field, value) {
  const v = String(value ?? '').trim();

  switch (field) {
    case 'description':
      if (!v)                          return 'Description is required.';
      if (!regex.description.test(v))  return 'No leading or trailing spaces allowed.';
      if (regex.duplicateWords.test(v)) return 'Duplicate words detected (e.g. "the the").';
      return null;

    case 'amount':
      if (!v)                         return 'Amount is required.';
      if (!regex.amount.test(v))      return 'Enter a valid positive amount (e.g. 12.50).';
      return null;

    case 'category':
      if (!v)                         return 'Category is required.';
      if (!regex.category.test(v))    return 'Letters, spaces, and hyphens only.';
      return null;

    case 'date':
      if (!v)                         return 'Date is required.';
      if (!regex.date.test(v))        return 'Date must be in YYYY-MM-DD format.';
      return null;

    default:
      return null;
  }
}
