# Create EC2 instance
resource "aws_instance" "main" {
  ami           = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name
  subnet_id     = var.public_subnet_id

  depends_on             = [aws_security_group.instance_security_group]
  vpc_security_group_ids = [aws_security_group.instance_security_group.id]

  user_data = file("${path.module}/installer.sh")

  tags = {
    Name = var.instance_name
  }
}

# Create a security group
resource "aws_security_group" "instance_security_group" {
  vpc_id = var.vpc_id

  # Example rule allowing inbound SSH traffic
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Example rule allowing inbound HTTP traffic
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "application_server_security_group"
  }
}
