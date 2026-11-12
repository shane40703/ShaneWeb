/** A Firestore error's code. FirestoreError.code is bare; a 'firestore/' prefix is dropped too. */
export function firestoreErrorCode(reason: unknown) {
  const code =
    reason && typeof reason === 'object' && 'code' in reason ? String(reason.code) : '';
  return code.replace(/^firestore\//, '');
}
