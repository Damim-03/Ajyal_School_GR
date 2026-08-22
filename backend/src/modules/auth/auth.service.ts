import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../core/config/app.config";
import { LoginInput } from "./auth.schema";
import {
  UnauthorizedException,
  NotFoundException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { JwtPayload, JwtRefreshPayload } from "../../types/auth.types";
import { prisma } from "../../core/prisma/client";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const generateAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);

const generateRefreshToken = (payload: JwtRefreshPayload): string =>
  jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);

// --------------------------------------------------
// User select — نفس الحقول في كل مكان
// --------------------------------------------------

const userSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatar: true,
  gender: true,
  isActive: true,
  lastLoginAt: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

// --------------------------------------------------
// Login
// --------------------------------------------------

export const loginService = async (body: LoginInput) => {
  const { username, userId, password } = body;

  // 1. البحث عن المستخدم — بالاسم أو بالمعرّف، والمخطَّط يضمن أحدَهما
  const user = await prisma.user.findUnique({
    where: userId ? { id: userId } : { username: username! },
    select: {
      ...userSelect,
      password: true, // نحتاجه للمقارنة فقط
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      "Invalid username or password",
      ErrorCodeEnum.AUTH_INVALID_CREDENTIALS,
    );
  }

  // 2. التحقق من الحساب
  if (!user.isActive) {
    throw new UnauthorizedException(
      "Your account has been suspended",
      ErrorCodeEnum.AUTH_ACCOUNT_SUSPENDED,
    );
  }

  // 3. التحقق من كلمة المرور
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedException(
      "Invalid username or password",
      ErrorCodeEnum.AUTH_INVALID_CREDENTIALS,
    );
  }

  // 4. توليد التوكنات
  const tokenPayload: JwtPayload = {
    userId: user.id,
    roleId: user.role.id,
    roleName: user.role.name,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ userId: user.id });

  // 5. تحديث lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // 6. إرجاع البيانات بدون password
  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, accessToken, refreshToken };
};

// --------------------------------------------------
// Refresh Token
// --------------------------------------------------

export const refreshTokenService = async (refreshToken: string) => {
  // 1. التحقق من الـ refresh token
  let decoded: JwtRefreshPayload;

  try {
    decoded = jwt.verify(
      refreshToken,
      config.JWT_REFRESH_SECRET,
    ) as JwtRefreshPayload;
  } catch {
    throw new UnauthorizedException(
      "Invalid or expired refresh token",
      ErrorCodeEnum.AUTH_INVALID_TOKEN,
    );
  }

  // 2. التحقق من المستخدم
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: userSelect,
  });

  if (!user) {
    throw new NotFoundException(
      "User not found",
      ErrorCodeEnum.AUTH_USER_NOT_FOUND,
    );
  }

  if (!user.isActive) {
    throw new UnauthorizedException(
      "Your account has been suspended",
      ErrorCodeEnum.AUTH_ACCOUNT_SUSPENDED,
    );
  }

  // 3. توليد access token جديد
  const accessToken = generateAccessToken({
    userId: user.id,
    roleId: user.role.id,
    roleName: user.role.name,
  });

  return { accessToken };
};

// --------------------------------------------------
// Me
// --------------------------------------------------

export const getMeService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...userSelect,
      role: {
        select: {
          id: true,
          name: true,
          permissions: {
            select: {
              permission: {
                select: {
                  name: true,
                  module: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundException(
      "User not found",
      ErrorCodeEnum.AUTH_USER_NOT_FOUND,
    );
  }

  // نُسطّح الـ permissions لقائمة بسيطة
  const permissions = user.role.permissions.map(
    (rp: { permission: { name: any } }) => rp.permission.name,
  );

  return { ...user, permissions };
};

/**
 * بطاقاتُ المستخدمين لشاشة الاختيار — **مسارٌ عامّ بلا مصادقة**.
 *
 * والحدُّ الأدنى حرفياً: معرّفٌ واسمُ عرضٍ وصورة. لا `username` ولا
 * بريد ولا دور ولا آخرُ دخول — فما يُكشف أسماءُ أشخاصٍ يعملون في
 * المؤسسة، لا مفاتيحُ تُقرّب من حساب. والدخولُ يقبل هذا المعرّف
 * (`loginSchema`) فلا حاجة إلى اسم الدخول في الشاشة أصلاً.
 *
 * والمعطَّلون يُستبعدون: عرضُ حسابٍ موقوفٍ يدعو إلى محاولةٍ ترتدّ،
 * ويُخبر أنّ الحساب كان موجوداً.
 *
 * والترتيبُ بآخر دخولٍ ثمّ بالاسم: من يستعمل هذا الجهاز يجد نفسه أوّلاً
 * كما في الأجهزة المنزلية، ومن لم يدخل قطّ يأتي بترتيبٍ ثابتٍ لا يقفز.
 */
export const listProfilesService = async () =>
  prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, avatar: true, gender: true },
    orderBy: [{ lastLoginAt: "desc" }, { firstName: "asc" }],
    take: 24,
  });
