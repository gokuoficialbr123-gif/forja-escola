// Byte-level regression guard: remove only the authorized registration/invite
// functions. Every other portal function, style and report must match the base.
export function withoutRegistrationChanges(html){
 return html.replace('<button class="small-btn" data-user-action="invite" title="Envia acesso para definir ou redefinir a senha">Reenviar convite</button>','').replace(/<style id="forja-new-user-style">[\s\S]*?<\/style>\n\n/,'')
 .replace(/function newUserModal\(\)\{[\s\S]*?\n\}\n(?:const pendingUserInvitations[\s\S]*?)?function showGeneratedLink/,'__NEW_USER__\nfunction showGeneratedLink')
 .replace(/async function openUser\(uid\)\{[\s\S]*?\n\}\nasync function userAction/,'__OPEN_USER__\nasync function userAction')
 .replace(/async function userAction\(uid,profile,action,btn\)\{[\s\S]*?\n\}\n/,'__USER_ACTION__\n')
 .replace(/async function createAccountFromEnrollment\(id,btn\)\{[^\n]*\}\n/,'__ENROLLMENT_ACCOUNT__\n');
}
