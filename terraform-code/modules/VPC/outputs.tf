output "vpc_id" {
  value = aws_vpc.project_vpc.id
}

output "vpc_public_subnet_1_id" {
  value = aws_subnet.public_subnet_1.id
}
