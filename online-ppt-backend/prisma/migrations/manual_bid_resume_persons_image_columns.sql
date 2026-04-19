-- 单人简历表：学历/工作证明等拆图路径（JSON 数组，与 resume_split_extract 一致）
ALTER TABLE `bid_resume_persons`
  ADD COLUMN `education_cert_image_paths` JSON NULL COMMENT '学历学位证书等图片路径',
  ADD COLUMN `work_proof_image_paths` JSON NULL COMMENT '项目经验证明等工作证明图片路径',
  ADD COLUMN `other_image_paths` JSON NULL COMMENT '未归类图片路径';
