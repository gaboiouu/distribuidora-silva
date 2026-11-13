ALTER TABLE "Sale" DROP CONSTRAINT "sale_balance_valid";
ALTER TABLE "Sale" ADD CONSTRAINT "sale_balance_valid"
  CHECK (total >= 0 AND paid >= 0 AND paid <= total AND (total > 0 OR status = 'CANCELLED'));
