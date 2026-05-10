export const resetPasswordTemplate = (resetLink) => {
    return `
  <div style="font-family: Arial, sans-serif; background:#f6f6f6; padding:40px;">
    
    <div style="max-width:600px; margin:auto; background:#ffffff; padding:30px; border-radius:10px; text-align:center;">

      <h2 style="color:#333;">Reset Password</h2>

      <p style="color:#555; font-size:14px; line-height:1.6;">
        Kamu menerima email ini karena ada permintaan reset password.
        Jika bukan kamu, abaikan email ini.
      </p>

      <a href="${resetLink}"
         style="
          display:inline-block;
          padding:12px 20px;
          background:#4f46e5;
          color:#fff;
          text-decoration:none;
          border-radius:6px;
          font-weight:bold;
          margin-top:20px;
         ">
        Reset Password
      </a>

      <p style="margin-top:25px; font-size:12px; color:#888;">
        Link ini akan kadaluarsa dalam beberapa menit.
      </p>

    </div>

    <div style="max-width:600px; margin:20px auto 0 auto; text-align:center; color:#999; font-size:11px;">

      <p style="margin-bottom:5px;">
        (c) ${new Date().getFullYear()} BiteYo App. All rights reserved.
      </p>

      <p style="margin-bottom:5px;">
        Biteyo, TB Simatupang, Jakarta Selatan, Indonesia
      </p>

      <p style="margin:0;">
        This email was sent automatically, please do not reply.
      </p>
    </div>
  </div>
  `;
};
